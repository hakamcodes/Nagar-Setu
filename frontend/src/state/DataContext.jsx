import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { addAdminNote, createComplaint, listComplaints, supportComplaint, updateComplaint } from "../services/complaintRepository.js";
import { buildAnalytics } from "../services/analyticsService.js";
import { getSeniorOfficerForZone, listOfficers, upsertOfficer } from "../services/officerService.js";
import { deleteNotification, listNotificationsFor, markNotificationRead, notify } from "../services/notificationService.js";
import { computeEscalationBumps } from "../services/escalationService.js";
import { regions, zones } from "../config/regions.js";
import { useAuth } from "./AuthContext.jsx";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const escalatingRef = useRef(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Complaints and the officer roster are fetched independently: the
      // complaint feed is public, but the roster requires sign-in, so a
      // logged-out visitor must still see complaints even if the roster
      // read is denied.
      const [complaintResult, rosterResult] = await Promise.allSettled([listComplaints(), listOfficers()]);
      const complaintList = complaintResult.status === "fulfilled" ? complaintResult.value : [];
      const roster = rosterResult.status === "fulfilled" ? rosterResult.value : [];
      if (complaintResult.status === "rejected") console.error("Failed to load complaints:", complaintResult.reason);
      if (rosterResult.status === "rejected") console.error("Failed to load officer roster:", rosterResult.reason);
      setOfficers(roster);

      // Deterministic SLA-breach escalation, applied client-side on refresh
      // (no scheduled backend job in this prototype - see plan notes).
      // Only signed-in officers/admins can write escalation bumps under the
      // Firestore rules, so this never runs for anonymous visitors.
      if (isAdmin && !escalatingRef.current) {
        escalatingRef.current = true;
        try {
          const bumps = computeEscalationBumps(complaintList, roster);
          if (bumps.length) {
            await Promise.all(
              bumps.map(async (bump) => {
                await updateComplaint(bump.complaintId, bump.patch, "system-escalation");
                await Promise.all(bump.notifyEmails.map((email) => notify(email, "escalation", bump.complaintId, bump.message)));
              }),
            );
            setComplaints(await listComplaints());
            return;
          }
        } catch (error) {
          console.error("Failed to apply SLA escalation:", error);
        } finally {
          escalatingRef.current = false;
        }
      }
      setComplaints(complaintList);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    refresh();
    const listener = () => refresh();
    window.addEventListener("nagar-setu-store-updated", listener);
    return () => window.removeEventListener("nagar-setu-store-updated", listener);
  }, [refresh]);

  const loadNotifications = useCallback(async () => {
    if (!user?.email) {
      setNotifications([]);
      return;
    }
    setNotifications(await listNotificationsFor(user.email));
  }, [user?.email]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications, complaints]);

  // A senior officer must see every complaint in their own zone as an
  // in-app notification, including ones filed before they ever signed in.
  // This backfills any zone complaint that doesn't already have a
  // "new-complaint" notification for this officer - it converges after one
  // extra notifications reload because the just-created ones then show up
  // in `notifications` and are excluded on the next pass.
  useEffect(() => {
    if (!user?.email || user.role !== "senior-officer" || !user.zoneNumber) return undefined;
    const zoneComplaints = complaints.filter((item) => item.zone?.number === user.zoneNumber);
    if (!zoneComplaints.length) return undefined;
    const notifiedComplaintIds = new Set(
      notifications.filter((item) => item.type === "new-complaint").map((item) => item.complaintId),
    );
    const missing = zoneComplaints.filter((item) => !notifiedComplaintIds.has(item.complaintId));
    if (!missing.length) return undefined;

    let cancelled = false;
    (async () => {
      await Promise.all(
        missing.map((item) =>
          notify(
            user.email,
            "new-complaint",
            item.complaintId,
            `New complaint in your zone${item.ward?.name ? ` (Ward ${item.ward.number} - ${item.ward.name})` : ""}: ${item.aiCategory || "Issue"}.`,
          ),
        ),
      );
      if (!cancelled) await loadNotifications();
    })();
    return () => {
      cancelled = true;
    };
  }, [complaints, loadNotifications, notifications, user?.email, user?.role, user?.zoneNumber]);

  const markNotificationsRead = useCallback(async (notificationId) => {
    await markNotificationRead(notificationId);
    await loadNotifications();
  }, [loadNotifications]);

  const removeNotification = useCallback(async (notificationId) => {
    await deleteNotification(notificationId);
    await loadNotifications();
  }, [loadNotifications]);

  const submitComplaint = useCallback(async (payload) => {
    const complaint = await createComplaint(payload);
    await refresh();
    return complaint;
  }, [refresh]);

  const saveComplaintPatch = useCallback(async (complaintId, patch, actorId) => {
    await updateComplaint(complaintId, patch, actorId);
    await refresh();
  }, [refresh]);

  const assignOfficer = useCallback(async (complaintId, officerEmail, officerName, actorId) => {
    await updateComplaint(
      complaintId,
      { assignedOfficerEmail: officerEmail, assignedOfficer: officerName, escalationLevel: 0, escalatedAt: "" },
      actorId,
    );
    await notify(officerEmail, "assignment", complaintId, "A new complaint has been assigned to you.");
    await refresh();
  }, [refresh]);

  const bounceToSenior = useCallback(async (complaint, reason, actorId) => {
    const senior = getSeniorOfficerForZone(complaint.zone?.number, officers);
    await updateComplaint(
      complaint.complaintId,
      { assignedOfficerEmail: "", assignedOfficer: "", escalationLevel: 1, escalatedAt: new Date().toISOString() },
      actorId,
    );
    if (senior) await notify(senior.email, "bounce", complaint.complaintId, reason || "A complaint was returned to you for reassignment.");
    await refresh();
    return senior;
  }, [officers, refresh]);

  const support = useCallback(async (complaintId, userId) => {
    const result = await supportComplaint(complaintId, userId);
    await refresh();
    return result;
  }, [refresh]);

  const note = useCallback(async (complaintId, adminId, text) => {
    await addAdminNote(complaintId, adminId, text);
    await refresh();
  }, [refresh]);

  const saveOfficer = useCallback(async (officer) => {
    await upsertOfficer(officer);
    await refresh();
  }, [refresh]);

  const analytics = useMemo(() => buildAnalytics(complaints, officers), [complaints, officers]);

  const value = useMemo(
    () => ({
      complaints,
      officers,
      notifications,
      regions,
      zones,
      analytics,
      loading,
      refresh,
      submitComplaint,
      saveComplaintPatch,
      assignOfficer,
      bounceToSenior,
      support,
      note,
      saveOfficer,
      markNotificationsRead,
      removeNotification,
    }),
    [
      analytics,
      assignOfficer,
      bounceToSenior,
      complaints,
      loading,
      markNotificationsRead,
      note,
      notifications,
      officers,
      refresh,
      removeNotification,
      saveComplaintPatch,
      saveOfficer,
      submitComplaint,
      support,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useData must be used inside DataProvider");
  return context;
}

import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase.js";
import { readStore, writeStore } from "./prototypeStore.js";

const SUPER_ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdminEmail(email) {
  return SUPER_ADMIN_EMAILS.includes((email || "").toLowerCase());
}

export function getSuperAdminEmails() {
  return SUPER_ADMIN_EMAILS;
}

export async function listOfficers() {
  if (isFirebaseConfigured) {
    const snapshot = await getDocs(collection(db, "officers"));
    return snapshot.docs.map((item) => item.data());
  }
  return readStore().officers || [];
}

// Officers are keyed by lowercase email so re-adding the same person always
// updates the same roster record instead of creating a duplicate.
export async function upsertOfficer(officer) {
  const record = {
    active: true,
    createdAt: new Date().toISOString(),
    ...officer,
    email: officer.email.trim().toLowerCase(),
  };

  if (isFirebaseConfigured) {
    await setDoc(doc(db, "officers", record.email), record, { merge: true });
    return record;
  }

  const store = readStore();
  const officers = store.officers || [];
  const exists = officers.some((item) => item.email === record.email);
  const next = exists
    ? officers.map((item) => (item.email === record.email ? { ...item, ...record } : item))
    : [...officers, record];
  writeStore({ ...store, officers: next });
  return record;
}

export async function setOfficerActive(email, active) {
  return upsertOfficer({ email, active });
}

// Super-admin identity always comes from VITE_ADMIN_EMAILS; everyone else is
// looked up in the roster. AI is never involved in this decision.
export function resolveRoleForEmail(email, roster) {
  const lower = (email || "").toLowerCase();
  if (isSuperAdminEmail(lower)) return { role: "super-admin", zoneNumber: null, name: "" };

  const officer = (roster || []).find((item) => item.email === lower && item.active !== false);
  if (officer) return { role: officer.roleTier, zoneNumber: officer.zoneNumber ?? null, name: officer.name || "" };

  return { role: "citizen", zoneNumber: null, name: "" };
}

export function getSeniorOfficerForZone(zoneNumber, roster) {
  if (!zoneNumber) return null;
  return (
    (roster || []).find(
      (item) => item.roleTier === "senior-officer" && item.zoneNumber === zoneNumber && item.active !== false,
    ) || null
  );
}

// What a signed-in officer is allowed to see: a junior officer only sees what
// is assigned to them, a senior officer sees everything in their zone, and a
// super admin sees everything. Citizens are handled separately (public feed).
export function getVisibleComplaints(user, complaints) {
  if (!user) return [];
  if (user.role === "super-admin") return complaints;
  if (user.role === "senior-officer") return complaints.filter((item) => item.zone?.number === user.zoneNumber);
  if (user.role === "junior-officer") return complaints.filter((item) => item.assignedOfficerEmail === user.email);
  return [];
}

// Who the current officer is allowed to hand a complaint to: a senior officer
// may only assign within their own zone's junior officers; a super admin may
// assign to any active senior or junior officer.
export function getAssignableOfficers(currentUser, roster) {
  const active = (roster || []).filter((item) => item.active !== false);
  if (currentUser?.role === "super-admin") {
    return active.filter((item) => item.roleTier !== "super-admin");
  }
  if (currentUser?.role === "senior-officer") {
    return active.filter((item) => item.roleTier === "junior-officer" && item.zoneNumber === currentUser.zoneNumber);
  }
  return [];
}

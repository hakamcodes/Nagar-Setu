import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, MapPin, ThumbsUp, Undo2, Upload } from "lucide-react";
import MapPanel from "../components/map/MapPanel.jsx";
import Timeline from "../components/complaints/Timeline.jsx";
import { Badge, PriorityBadge, StatusBadge } from "../components/ui/Badge.jsx";
import { formatDateTime, timeAgo } from "../utils/date.js";
import { complaintStatuses } from "../config/regions.js";
import { isSlaBreached } from "../config/sla.js";
import { compressImageToBase64 } from "../utils/image.js";
import { getAssignableOfficers } from "../services/officerService.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useToast } from "../state/ToastContext.jsx";

export default function ComplaintDetail() {
  const { complaintId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { complaints, officers, support, saveComplaintPatch, assignOfficer, bounceToSenior, note } = useData();
  const { showToast } = useToast();
  const [adminNote, setAdminNote] = useState("");
  const [resolutionImage, setResolutionImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const complaint = useMemo(() => complaints.find((item) => item.complaintId === complaintId), [complaintId, complaints]);
  const assignable = useMemo(() => (isAdmin ? getAssignableOfficers(user, officers) : []), [isAdmin, officers, user]);

  if (!complaint) {
    return (
      <section className="section">
        <div className="card p-6">Complaint not found.</div>
      </section>
    );
  }

  const breached = isSlaBreached(complaint);
  const activeRisks = Object.entries(complaint.aiRisks || {}).filter(([, level]) => level && level !== "Low");
  const isAssignedToMe = user?.role === "junior-officer" && complaint.assignedOfficerEmail === user.email;
  const canManage =
    isAdmin &&
    (user.role === "super-admin" ||
      (user.role === "senior-officer" && complaint.zone?.number === user.zoneNumber) ||
      isAssignedToMe);
  const canAssign = canManage && ["super-admin", "senior-officer"].includes(user.role);

  async function handleSupport() {
    if (!user) {
      showToast("Please log in to support this issue.", "error");
      navigate("/signin", { state: { from: { pathname: `/complaints/${complaintId}` } } });
      return;
    }
    try {
      const result = await support(complaint.complaintId, user.uid);
      showToast(result.alreadySupported ? "You already support this issue." : "Support recorded.");
    } catch (error) {
      if (error.code === "permission-denied") {
        showToast("Please log in to support this issue.", "error");
        navigate("/signin", { state: { from: { pathname: `/complaints/${complaintId}` } } });
      } else {
        showToast(error.message || "Could not record support.", "error");
      }
    }
  }

  async function handleAdminPatch(patch) {
    try {
      await saveComplaintPatch(complaint.complaintId, patch, user.uid);
      showToast("Complaint updated.");
    } catch (error) {
      showToast(error.message || "Could not update complaint.", "error");
    }
  }

  async function handleAssign(email) {
    const officer = officers.find((item) => item.email === email);
    await assignOfficer(complaint.complaintId, email, officer?.name || email, user.uid);
    showToast(email ? `Assigned to ${officer?.name || email}.` : "Unassigned.");
  }

  async function handleBounce() {
    const senior = await bounceToSenior(complaint, `${user.name} returned this complaint for reassignment.`, user.uid);
    showToast(senior ? `Returned to ${senior.name || senior.email}.` : "Returned - no senior officer found for this zone yet.");
  }

  async function handleResolutionUpload(file) {
    try {
      const compressed = await compressImageToBase64(file);
      setResolutionImage(compressed.imageData);
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function markResolvedWithProof() {
    if (!resolutionImage) {
      showToast("Upload a resolution photo first.", "error");
      return;
    }
    setBusy(true);
    try {
      await saveComplaintPatch(complaint.complaintId, { status: "Resolved", resolutionImageData: resolutionImage }, user.uid);
      showToast("Complaint marked Resolved.");
      setResolutionImage(null);
    } catch (error) {
      showToast(error.message || "Could not mark Resolved.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!adminNote.trim()) return;
    await note(complaint.complaintId, user.uid, adminNote.trim());
    setAdminNote("");
    showToast("Admin note saved.");
  }

  return (
    <section className="section">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/complaints" className="inline-flex items-center gap-1.5 text-sm font-bold text-civic transition hover:gap-2">
            <ArrowLeft size={15} /> Back to complaints
          </Link>
          <h1 className="mt-2 text-3xl font-black tracking-tight">{complaint.aiSummary}</h1>
        </div>
        <button type="button" className="btn-primary" onClick={handleSupport}>
          <ThumbsUp size={17} />
          Support ({complaint.supportCount || 0})
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="space-y-5">
          <div className="card overflow-hidden">
            <div className="grid min-h-80 place-items-center bg-slate-100">
              {complaint.imageData ? <img src={complaint.imageData} alt="" className="max-h-[560px] w-full object-contain" /> : <span className="text-slate-500">No image in sample record</span>}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={complaint.status} />
                <PriorityBadge priority={complaint.aiPriority} />
                <Badge className="border-slate-200 bg-slate-50 text-ink">{complaint.aiCategory}{complaint.aiSubcategory ? ` - ${complaint.aiSubcategory}` : ""}</Badge>
                {breached && <Badge className="border-red-200 bg-red-50 text-red-800" dotClassName="bg-red-600">SLA breached</Badge>}
                {complaint.escalationLevel > 0 && (
                  <Badge className="border-red-200 bg-red-50 text-red-800" dotClassName="bg-red-600">Escalated (level {complaint.escalationLevel})</Badge>
                )}
                {activeRisks.map(([key, level]) => (
                  <Badge key={key} className="border-amber-200 bg-amber-50 text-amber-900" dotClassName="bg-amber-600">{key}: {level}</Badge>
                ))}
              </div>
              <p className="leading-7 text-slate-700">{complaint.description}</p>
              <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                {[
                  ["Municipality", complaint.municipality || "-"],
                  ["Ward", complaint.ward ? `${complaint.ward.number} - ${complaint.ward.name}` : complaint.zoneName || "Unmapped"],
                  ["Zone", complaint.zone ? `Zone ${complaint.zone.number}` : "-"],
                  ["Locality", complaint.locality || "-"],
                  ["Department", complaint.assignedDepartment || "Not assigned"],
                  ["Assigned officer", complaint.assignedOfficer || "Unassigned"],
                  ["Created", formatDateTime(complaint.createdAt)],
                  ["Updated", formatDateTime(complaint.updatedAt)],
                  ["SLA due", complaint.slaDueAt ? `${formatDateTime(complaint.slaDueAt)} (${timeAgo(complaint.slaDueAt)})` : "-"],
                  ["Civic impact score", complaint.aiCivicImpactScore ?? "-"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
                    <span className="block text-xs text-slate-500">{label}</span>
                    <strong className="text-ink">{value}</strong>
                  </div>
                ))}
              </div>
              {complaint.aiRecommendedAction && (
                <p className="rounded-md border border-teal-100 bg-teal-50/60 p-3 text-sm text-teal-950"><strong>Recommended action:</strong> {complaint.aiRecommendedAction}</p>
              )}
              {complaint.resolutionImageData && (
                <div>
                  <p className="mb-2 text-sm font-bold">Resolution proof</p>
                  <img src={complaint.resolutionImageData} alt="Resolution proof" className="max-h-64 rounded-lg border border-slate-200 object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><MapPin size={18} className="text-civic" /> Location preview</h2>
            <MapPanel complaints={[complaint]} regionId={complaint.regionId} height={360} />
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><Clock3 size={18} className="text-civic" /> Status timeline</h2>
            <div className="mt-5">
              <Timeline items={complaint.timeline || []} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black"><MapPin size={20} /> GPS and address</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-700">
              <p>Latitude: {complaint.latitude?.toFixed?.(6) || complaint.latitude}</p>
              <p>Longitude: {complaint.longitude?.toFixed?.(6) || complaint.longitude}</p>
              <p>Accuracy: {complaint.accuracy ? `${Math.round(complaint.accuracy)}m` : "Not available"}</p>
              <p>Road: {complaint.road || "-"}</p>
              <p>Address: {complaint.formattedAddress || "-"}</p>
            </div>
          </div>

          {complaint.adminNotes && (
            <div className="card p-5">
              <h2 className="text-xl font-black">Admin note</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700">{complaint.adminNotes}</p>
            </div>
          )}

          {canManage && (
            <div className="card space-y-4 p-5">
              <h2 className="text-xl font-black">Admin actions</h2>

              {canAssign && (
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Assign officer</span>
                  <select className="field" value={complaint.assignedOfficerEmail || ""} onChange={(event) => handleAssign(event.target.value)}>
                    <option value="">Unassigned</option>
                    {assignable.map((officer) => <option key={officer.email} value={officer.email}>{officer.name || officer.email}</option>)}
                  </select>
                </label>
              )}

              <select
                className="field"
                value={complaint.status}
                onChange={(event) => {
                  if (event.target.value === "Resolved") {
                    showToast("Use the resolution photo upload below to mark this Resolved.", "error");
                    return;
                  }
                  handleAdminPatch({ status: event.target.value });
                }}
              >
                {complaintStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>

              {complaint.status !== "Resolved" && (
                <div className="rounded-lg border border-dashed border-slate-300 p-3">
                  <p className="mb-2 text-sm font-bold">Resolution photo (required to mark Resolved)</p>
                  {resolutionImage && <img src={resolutionImage} alt="" className="mb-2 max-h-40 rounded-md object-contain" />}
                  <input type="file" accept="image/*" className="text-sm" onChange={(event) => handleResolutionUpload(event.target.files?.[0])} />
                  <button type="button" className="btn-primary mt-3 w-full" onClick={markResolvedWithProof} disabled={busy || !resolutionImage}>
                    <Upload size={16} />
                    Mark Resolved with proof
                  </button>
                </div>
              )}

              {isAssignedToMe && (
                <button type="button" className="btn-secondary w-full" onClick={handleBounce}>
                  <Undo2 size={16} />
                  Return to senior officer
                </button>
              )}

              <textarea className="field min-h-24" value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Internal note" />
              <button type="button" className="btn-secondary w-full" onClick={saveNote}>Save note</button>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

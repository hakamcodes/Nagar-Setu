import { useMemo } from "react";
import { Link } from "react-router-dom";
import AdminNav from "./AdminNav.jsx";
import { complaintStatuses, issueCategories } from "../../config/regions.js";
import { isSlaBreached } from "../../config/sla.js";
import { getAssignableOfficers, getVisibleComplaints } from "../../services/officerService.js";
import { Badge, PriorityBadge, StatusBadge } from "../../components/ui/Badge.jsx";
import { timeAgo } from "../../utils/date.js";
import { useAuth } from "../../state/AuthContext.jsx";
import { useData } from "../../state/DataContext.jsx";
import { useToast } from "../../state/ToastContext.jsx";

export default function AdminComplaints() {
  const { user } = useAuth();
  const { complaints, officers, saveComplaintPatch, assignOfficer } = useData();
  const { showToast } = useToast();
  const scoped = useMemo(() => getVisibleComplaints(user, complaints), [complaints, user]);
  const assignable = useMemo(() => getAssignableOfficers(user, officers), [officers, user]);

  async function patch(id, payload) {
    try {
      await saveComplaintPatch(id, payload, user.uid);
      showToast("Complaint updated.");
    } catch (error) {
      showToast(error.message || "Could not update complaint.", "error");
    }
  }

  async function assign(complaintId, officerEmail) {
    if (!officerEmail) return;
    const officer = officers.find((item) => item.email === officerEmail);
    await assignOfficer(complaintId, officerEmail, officer?.name || officerEmail, user.uid);
    showToast(`Assigned to ${officer?.name || officerEmail}.`);
  }

  return (
    <section className="section">
      <AdminNav />
      <div className="mb-6">
        <p className="eyebrow">Operations</p>
        <h1 className="page-title">Admin complaints table</h1>
        {user.role !== "super-admin" && (
          <p className="mt-2 text-sm text-slate-600">
            {user.role === "senior-officer" ? `Showing complaints in your zone (Zone ${user.zoneNumber}).` : "Showing complaints assigned to you."}
          </p>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Ward / Zone</th>
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">SLA</th>
                <th className="px-4 py-3">Support</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scoped.map((complaint) => {
                const breached = isSlaBreached(complaint);
                const canAssign = user.role === "super-admin" || user.role === "senior-officer";
                return (
                  <tr key={complaint.complaintId} className="align-top transition-colors hover:bg-teal-50/40">
                    <td className="max-w-xs px-4 py-4">
                      <Link to={`/complaints/${complaint.complaintId}`} className="font-black text-ink transition hover:text-civic">
                        {complaint.aiSummary}
                      </Link>
                      <p className="mt-1 line-clamp-2 text-slate-500">{complaint.description}</p>
                      {complaint.escalationLevel > 0 && (
                        <Badge className="mt-1 border-red-200 bg-red-50 text-red-800" dotClassName="bg-red-600">
                          Escalated (level {complaint.escalationLevel})
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <select
                        className="field min-w-36"
                        value={complaint.status}
                        onChange={(event) => {
                          if (event.target.value === "Resolved" && !complaint.resolutionImageData) {
                            showToast("Upload a resolution photo on the complaint detail page before marking Resolved.", "error");
                            return;
                          }
                          patch(complaint.complaintId, { status: event.target.value });
                        }}
                      >
                        {complaintStatuses.map((status) => <option key={status}>{status}</option>)}
                      </select>
                      <div className="mt-2"><StatusBadge status={complaint.status} /></div>
                    </td>
                    <td className="px-4 py-4"><PriorityBadge priority={complaint.aiPriority} /></td>
                    <td className="px-4 py-4">
                      <select className="field min-w-44" value={complaint.aiCategory} onChange={(event) => patch(complaint.complaintId, { aiCategory: event.target.value })}>
                        {issueCategories.map((category) => <option key={category}>{category}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4 font-semibold">
                      {complaint.ward ? `Ward ${complaint.ward.number}` : complaint.zoneName || "Unmapped"}
                      {complaint.zone && <div className="text-xs font-normal text-slate-500">Zone {complaint.zone.number}</div>}
                    </td>
                    <td className="px-4 py-4">
                      {canAssign ? (
                        <select className="field min-w-48" value={complaint.assignedOfficerEmail || ""} onChange={(event) => assign(complaint.complaintId, event.target.value)}>
                          <option value="">Unassigned</option>
                          {assignable.map((officer) => <option key={officer.email} value={officer.email}>{officer.name || officer.email}</option>)}
                        </select>
                      ) : (
                        <span>{complaint.assignedOfficer || "Unassigned"}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {breached ? (
                        <Badge className="border-red-200 bg-red-50 text-red-800" dotClassName="bg-red-600">Breached</Badge>
                      ) : (
                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" dotClassName="bg-emerald-600">On track</Badge>
                      )}
                    </td>
                    <td className="px-4 py-4 font-bold">{complaint.supportCount || 0}</td>
                    <td className="px-4 py-4 text-slate-500">{timeAgo(complaint.updatedAt)}</td>
                  </tr>
                );
              })}
              {scoped.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No complaints in your scope yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

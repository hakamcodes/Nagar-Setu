import { getSeniorOfficerForZone, getSuperAdminEmails } from "./officerService.js";

const CLOSED_LIKE = ["Resolved", "Rejected", "Duplicate"];

// Deterministic SLA-breach escalation - no AI involved. Visibility is already
// scope-based (senior officers see their whole zone, super admins see
// everything); escalationLevel is purely an attention/notification signal on
// top of that. Level 1 fires once the SLA deadline passes; level 2 fires once
// the deadline has been missed by as long as the original SLA window again.
export function computeEscalationBumps(complaints, roster) {
  const now = Date.now();
  const bumps = [];

  for (const complaint of complaints) {
    if (CLOSED_LIKE.includes(complaint.status)) continue;
    if (!complaint.slaDueAt) continue;

    const dueAt = new Date(complaint.slaDueAt).getTime();
    const createdAt = new Date(complaint.createdAt).getTime();
    const currentLevel = complaint.escalationLevel || 0;

    let nextLevel = currentLevel;
    if (currentLevel < 2 && now > dueAt + (dueAt - createdAt)) nextLevel = 2;
    else if (currentLevel < 1 && now > dueAt) nextLevel = 1;

    if (nextLevel === currentLevel) continue;

    const summary = complaint.aiSummary || complaint.description;
    let notifyEmails = [];
    let message = "";

    if (nextLevel === 1) {
      const senior = complaint.zone?.number ? getSeniorOfficerForZone(complaint.zone.number, roster) : null;
      notifyEmails = senior ? [senior.email] : [];
      message = `SLA breached: "${summary}" in Zone ${complaint.zone?.number ?? "?"} needs attention.`;
    } else {
      notifyEmails = getSuperAdminEmails();
      message = `Overdue escalation: "${summary}" has missed its SLA badly and needs top-level attention.`;
    }

    bumps.push({
      complaintId: complaint.complaintId,
      patch: { escalationLevel: nextLevel, escalatedAt: new Date().toISOString() },
      notifyEmails,
      message,
    });
  }

  return bumps;
}

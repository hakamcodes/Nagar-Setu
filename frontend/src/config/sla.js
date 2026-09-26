const SLA_HOURS_BY_PRIORITY = {
  Critical: 24,
  High: 72,
  Medium: 24 * 7,
  Low: 24 * 14,
};

export function computeSlaDueAt(priority, fromIso = new Date().toISOString()) {
  const hours = SLA_HOURS_BY_PRIORITY[priority] || SLA_HOURS_BY_PRIORITY.Medium;
  return new Date(new Date(fromIso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function isSlaBreached(complaint) {
  if (!complaint.slaDueAt) return false;
  if (["Resolved", "Rejected", "Duplicate"].includes(complaint.status)) return false;
  return new Date(complaint.slaDueAt).getTime() < Date.now();
}

import { generateAdminSummary } from "./aiService.js";
import { buildComplaintClusters } from "./clusterService.js";
import { isSlaBreached } from "../config/sla.js";

const RESOLVED_LIKE = ["Resolved"];
const CLOSED_LIKE = ["Resolved", "Rejected", "Duplicate"];

function countBy(complaints, field) {
  return complaints.reduce((acc, item) => {
    const key = item[field] || "Unmapped";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function avgResolutionHours(complaints) {
  const resolved = complaints.filter((item) => RESOLVED_LIKE.includes(item.status) && item.resolvedAt);
  if (!resolved.length) return null;
  const totalHours = resolved.reduce((sum, item) => {
    const hours = (new Date(item.resolvedAt).getTime() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60);
    return sum + Math.max(0, hours);
  }, 0);
  return Math.round((totalHours / resolved.length) * 10) / 10;
}

function departmentPerformance(complaints) {
  const byDept = countBy(complaints, "assignedDepartment");
  return Object.keys(byDept).map((department) => {
    const items = complaints.filter((item) => (item.assignedDepartment || "Unmapped") === department);
    const resolved = items.filter((item) => RESOLVED_LIKE.includes(item.status));
    return {
      department,
      total: items.length,
      resolved: resolved.length,
      resolutionRate: items.length ? Math.round((resolved.length / items.length) * 100) : 0,
      avgResolutionHours: avgResolutionHours(items),
    };
  });
}

function officerPerformance(complaints, roster) {
  const officers = (roster || []).filter((item) => item.roleTier === "junior-officer");
  return officers.map((officer) => {
    const items = complaints.filter((item) => item.assignedOfficerEmail === officer.email);
    const resolved = items.filter((item) => RESOLVED_LIKE.includes(item.status));
    const escalated = items.filter((item) => (item.escalationLevel || 0) > 0);
    return {
      email: officer.email,
      name: officer.name || officer.email,
      zoneNumber: officer.zoneNumber,
      total: items.length,
      resolved: resolved.length,
      resolutionRate: items.length ? Math.round((resolved.length / items.length) * 100) : 0,
      avgResolutionHours: avgResolutionHours(items),
      escalations: escalated.length,
    };
  });
}

// Deterministic emerging-hotspot signal: compares this-week vs previous-week
// complaint counts per ward/zone. No AI involved — trend math only.
function detectTrends(complaints) {
  const now = Date.now();
  const week = 7 * 24 * 60 * 60 * 1000;
  const byArea = (item) => item.ward?.name || item.zoneName || "Unmapped";

  const groupCount = (list) =>
    list.reduce((acc, item) => {
      const key = byArea(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const thisWeekByArea = groupCount(complaints.filter((item) => now - new Date(item.createdAt).getTime() <= week));
  const lastWeekByArea = groupCount(
    complaints.filter((item) => {
      const age = now - new Date(item.createdAt).getTime();
      return age > week && age <= week * 2;
    }),
  );

  return Object.entries(thisWeekByArea)
    .map(([area, count]) => ({ area, count, previousCount: lastWeekByArea[area] || 0, delta: count - (lastWeekByArea[area] || 0) }))
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
}

export function buildAnalytics(complaints, roster = []) {
  const unresolved = complaints.filter((item) => !CLOSED_LIKE.includes(item.status));
  const resolved = complaints.filter((item) => item.status === "Resolved");
  const highPriority = complaints.filter((item) => ["High", "Critical"].includes(item.aiPriority));
  const slaBreached = complaints.filter((item) => isSlaBreached(item));
  const clusters = buildComplaintClusters(complaints);

  const duplicateClusters = complaints.reduce((acc, item) => {
    if (!item.duplicateGroupId) return acc;
    acc[item.duplicateGroupId] = (acc[item.duplicateGroupId] || 0) + 1;
    return acc;
  }, {});

  const byWard = complaints.reduce((acc, item) => {
    const key = item.ward?.name || "Unmapped";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const byZone = complaints.reduce((acc, item) => {
    const key = item.zone?.number ? `Zone ${item.zone.number}` : item.zoneName || "Unmapped";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const civicImpactScores = complaints.map((item) => item.aiCivicImpactScore).filter((value) => typeof value === "number");
  const avgCivicImpactScore = civicImpactScores.length
    ? Math.round(civicImpactScores.reduce((sum, value) => sum + value, 0) / civicImpactScores.length)
    : null;

  const topWard = Object.entries(byWard).sort((a, b) => b[1] - a[1])[0];

  return {
    total: complaints.length,
    open: complaints.filter((item) => item.status === "Open").length,
    inProgress: complaints.filter((item) => item.status === "In Progress").length,
    resolved: resolved.length,
    unresolved: unresolved.length,
    highPriority: highPriority.length,
    slaBreached: slaBreached.length,
    resolutionRate: complaints.length ? Math.round((resolved.length / complaints.length) * 100) : 0,
    avgResolutionHours: avgResolutionHours(complaints),
    avgCivicImpactScore,
    hotspotCount: clusters.length,
    clusters,
    byWard,
    byZone,
    byCategory: countBy(complaints, "aiCategory"),
    byPriority: countBy(complaints, "aiPriority"),
    byStatus: countBy(complaints, "status"),
    departmentPerformance: departmentPerformance(complaints),
    officerPerformance: officerPerformance(complaints, roster),
    trends: detectTrends(complaints),
    duplicateClusters: Object.entries(duplicateClusters).filter(([, count]) => count > 1).length,
    topProblemZones: Object.entries(byZone).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topWardsList: Object.entries(byWard).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topCategories: Object.entries(countBy(complaints, "aiCategory")).sort((a, b) => b[1] - a[1]).slice(0, 5),
    topWard: topWard?.[0] || null,
    adminSummary: generateAdminSummary(complaints),
  };
}

import { scoreAgainst } from "./duplicateService.js";

const CLUSTER_THRESHOLD = 0.5;

// Deterministic greedy clustering of open complaints into civic hotspots,
// reusing the same ward/zone/category/geo/text scoring used for duplicate
// detection. No AI involved — a cluster is just complaints that mutually score
// above the threshold against the cluster's first (representative) member.
export function buildComplaintClusters(complaints) {
  const open = complaints
    .filter((item) => !["Resolved", "Rejected", "Duplicate"].includes(item.status))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const clusters = [];

  for (const complaint of open) {
    const createdAt = new Date(complaint.createdAt).getTime();
    const match = clusters.find((cluster) => scoreAgainst(complaint, cluster.representative, createdAt).score >= CLUSTER_THRESHOLD);
    if (match) {
      match.members.push(complaint);
    } else {
      clusters.push({ representative: complaint, members: [complaint] });
    }
  }

  return clusters
    .filter((cluster) => cluster.members.length > 1)
    .map((cluster) => ({
      clusterId: `cluster-${cluster.representative.complaintId}`,
      representative: cluster.representative,
      memberIds: cluster.members.map((item) => item.complaintId),
      count: cluster.members.length,
      wardName: cluster.representative.ward?.name || cluster.representative.zoneName || "Unmapped",
      category: cluster.representative.aiCategory,
    }))
    .sort((a, b) => b.count - a.count);
}

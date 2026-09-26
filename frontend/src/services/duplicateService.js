import { distanceMeters } from "../utils/geo.js";
import { jaccardSimilarity } from "../utils/text.js";
import { imageHashSimilarity } from "../utils/image.js";

const RECENT_WINDOW_DAYS = 21;

export function scoreAgainst(candidate, complaint, createdAt) {
  const sameZone = complaint.zoneId && complaint.zoneId === candidate.zoneId;
  const sameWard = complaint.ward?.number && complaint.ward.number === candidate.ward?.number;
  const categoryMatch = complaint.aiCategory === candidate.aiCategory;
  const textScore = jaccardSimilarity(candidate.description, complaint.description);
  const daysApart = Math.abs(createdAt - new Date(complaint.createdAt).getTime()) / (1000 * 60 * 60 * 24);
  const recent = daysApart <= RECENT_WINDOW_DAYS;
  const geoDistance =
    candidate.latitude && complaint.latitude
      ? distanceMeters(
          { latitude: candidate.latitude, longitude: candidate.longitude },
          { latitude: complaint.latitude, longitude: complaint.longitude },
        )
      : Infinity;
  const nearby = sameZone || sameWard || geoDistance <= 180;
  const imageScore =
    candidate.imageHash && complaint.imageHash ? imageHashSimilarity(candidate.imageHash, complaint.imageHash) : 0;

  const score =
    (sameWard ? 0.2 : 0) +
    (sameZone ? 0.12 : 0) +
    (nearby ? 0.14 : 0) +
    (categoryMatch ? 0.2 : 0) +
    Math.min(0.2, textScore * 0.35) +
    (recent ? 0.06 : 0) +
    Math.min(0.08, imageScore > 0.85 ? imageScore * 0.08 : 0);

  return { complaint, score, textScore, nearby, categoryMatch, duplicatePercentage: Math.round(Math.min(1, score) * 100) };
}

export function findLikelyDuplicate(candidate, complaints) {
  const createdAt = new Date(candidate.createdAt || Date.now()).getTime();
  const scored = complaints
    .filter((complaint) => complaint.regionId === candidate.regionId)
    .filter((complaint) => !["Resolved", "Rejected", "Duplicate"].includes(complaint.status))
    .map((complaint) => scoreAgainst(candidate, complaint, createdAt))
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || best.score < 0.58) return null;
  return best;
}

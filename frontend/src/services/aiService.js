import { issueCategories, priorities, resolveDepartmentForCategory } from "../config/regions.js";

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];

function clamp(value, min, max, fallback) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

const categoryRules = [
  { category: "Road Damage", words: ["pothole", "road", "damaged road", "crack", "asphalt"] },
  { category: "Garbage", words: ["garbage", "trash", "waste", "dump", "litter"] },
  { category: "Streetlight", words: ["streetlight", "light", "dark", "lamp"] },
  { category: "Waterlogging", words: ["waterlogging", "flood", "rain water", "stagnant"] },
  { category: "Blocked Drain", words: ["drain", "sewer", "blocked", "clog"] },
  { category: "Water Leak", words: ["leak", "pipe", "tap", "water"] },
  { category: "Electrical", words: ["wire", "electric", "spark", "power", "switch"] },
  { category: "Hostel Maintenance", words: ["hostel", "room", "mess", "bathroom"] },
  { category: "Sanitation", words: ["toilet", "sanitation", "smell", "dirty"] },
  { category: "Broken Furniture", words: ["bench", "chair", "table", "furniture", "broken"] },
  { category: "Safety Hazard", words: ["danger", "hazard", "unsafe", "injury", "exposed"] },
  { category: "Illegal Construction", words: ["illegal construction", "encroachment", "unauthorized"] },
  { category: "Stray Animal", words: ["stray", "dog", "cattle", "animal"] },
  { category: "Tree / Garden Maintenance", words: ["tree", "garden", "park", "branch"] },
  { category: "Traffic / Signage", words: ["traffic", "signal", "signage", "sign board"] },
];

function choosePriority(description, category) {
  const text = description.toLowerCase();
  if (/(fire|shock|injury|accident|danger|critical|severe|exposed wire)/.test(text)) return "Critical";
  if (/(blocked|flood|pothole|unsafe|leak|stagnant|night)/.test(text)) return "High";
  if (["Road Damage", "Blocked Drain", "Electrical", "Safety Hazard"].includes(category)) return "High";
  return "Medium";
}

function assessRisks(text, category) {
  const risks = { publicHealth: "Low", safety: "Low", environmental: "Low", traffic: "Low" };
  if (/(sewer|drain|garbage|waste|sanitation|toilet|stray|dead animal)/.test(text) || ["Sanitation", "Garbage", "Blocked Drain", "Stray Animal"].includes(category)) {
    risks.publicHealth = "Medium";
  }
  if (/(fire|shock|exposed wire|injury|accident|collapse)/.test(text) || category === "Safety Hazard") {
    risks.safety = "High";
  }
  if (/(flood|waterlogging|stagnant|overflow|chemical|smoke)/.test(text) || category === "Waterlogging") {
    risks.environmental = "Medium";
  }
  if (/(pothole|traffic|signal|blocked road|accident)/.test(text) || ["Road Damage", "Traffic / Signage"].includes(category)) {
    risks.traffic = "Medium";
  }
  return risks;
}

function civicImpactFromPriority(priority) {
  return { Critical: 90, High: 70, Medium: 45, Low: 20 }[priority] || 40;
}

function heuristicClassify({ description, zoneName, regionId }) {
  const text = description.toLowerCase();
  const matched = categoryRules
    .map((rule) => ({
      category: rule.category,
      score: rule.words.reduce((total, word) => total + (text.includes(word) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  const category = matched?.score ? matched.category : "Other";
  const priority = choosePriority(description, category);
  const summaryBase = description.trim().replace(/\s+/g, " ");
  const summary = summaryBase.length > 110 ? `${summaryBase.slice(0, 107)}...` : summaryBase;
  const confidence = matched?.score ? Math.min(0.95, 0.62 + matched.score * 0.12) : 0.48;

  return {
    category,
    subcategory: "",
    priority,
    severityScore: Math.round(civicImpactFromPriority(priority) / 10),
    summary: summary || `Issue reported${zoneName ? ` near ${zoneName}` : ""}.`,
    confidence,
    aiSuggestedDepartment: resolveDepartmentForCategory(category, regionId),
    recommendedAction: "Route to the responsible department for on-site inspection.",
    tags: [...new Set([category.toLowerCase(), ...(zoneName ? [zoneName.toLowerCase()] : [])])],
    risks: assessRisks(text, category),
    civicImpactScore: civicImpactFromPriority(priority),
    imageObservations: "",
    duplicateContext: "",
    source: "heuristic",
  };
}

function normalizeClassification(result, { description, zoneName, regionId }) {
  const category = issueCategories.includes(result.category) ? result.category : "Other";
  const priority = priorities.includes(result.priority) ? result.priority : "Medium";
  return {
    category,
    subcategory: result.subcategory || "",
    priority,
    severityScore: clamp(result.severityScore, 1, 10, Math.round(civicImpactFromPriority(priority) / 10)),
    summary: result.summary || description,
    confidence: clamp(result.confidence, 0, 1, 0.6),
    aiSuggestedDepartment: result.aiSuggestedDepartment || resolveDepartmentForCategory(category, regionId),
    recommendedAction: result.recommendedAction || "Route to the responsible department for on-site inspection.",
    tags: Array.isArray(result.tags) ? result.tags : [],
    risks: {
      publicHealth: RISK_LEVELS.includes(result.risks?.publicHealth) ? result.risks.publicHealth : "Low",
      safety: RISK_LEVELS.includes(result.risks?.safety) ? result.risks.safety : "Low",
      environmental: RISK_LEVELS.includes(result.risks?.environmental) ? result.risks.environmental : "Low",
      traffic: RISK_LEVELS.includes(result.risks?.traffic) ? result.risks.traffic : "Low",
    },
    civicImpactScore: clamp(result.civicImpactScore, 0, 100, civicImpactFromPriority(priority)),
    imageObservations: result.imageObservations || "",
    duplicateContext: result.duplicateContext || "",
    source: result.source || "claude",
  };
}

// AI calls always go through the backend proxy, which holds the provider API
// keys server-side. The browser never talks to Anthropic/Groq directly - if
// the backend is unset or fails, we fall straight to the deterministic
// heuristic below rather than exposing a key to the client.
export async function classifyComplaint({ description, imageData, zoneName, regionName, regionId }) {
  const backendUrl = import.meta.env.VITE_BACKEND_API_BASE_URL;

  if (backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/ai/classify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, imageData, zoneName, regionName, regionId }),
      });
      if (!response.ok) throw new Error("AI backend request failed.");
      return normalizeClassification(await response.json(), { description, zoneName, regionId });
    } catch (error) {
      console.warn("AI backend failed, using heuristic fallback.", error);
    }
  }

  return heuristicClassify({ description, zoneName, regionId });
}

export function generateAdminSummary(complaints) {
  const open = complaints.filter((item) => !["Resolved", "Rejected", "Duplicate"].includes(item.status)).length;
  const high = complaints.filter((item) => ["High", "Critical"].includes(item.aiPriority)).length;
  const topZone = Object.entries(
    complaints.reduce((acc, item) => ({ ...acc, [item.zoneName]: (acc[item.zoneName] || 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1])[0];

  return `${open} unresolved issues need attention, including ${high} high-priority reports. ${topZone ? `${topZone[0]} is currently the most active zone.` : "No hotspot has emerged yet."}`;
}

// Narrates already-computed deterministic aggregate stats (never invents
// ward/zone/department numbers itself). Falls back to the plain template
// summary below when the backend is unset or unavailable.
export async function generateCivicBriefing(stats, region) {
  const backendUrl = import.meta.env.VITE_BACKEND_API_BASE_URL;
  const fallback = () =>
    `${stats.open} open issues across ${region.name}, including ${stats.highPriority} high-priority and ${stats.slaBreached} SLA-breached. Top hotspot ward: ${stats.topWard || "none yet"}.`;

  if (backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/ai/briefing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats, region }),
      });
      if (!response.ok) throw new Error("AI backend briefing request failed.");
      const data = await response.json();
      if (data.text) return data.text;
    } catch (error) {
      console.warn("AI backend briefing failed, using deterministic summary.", error);
    }
  }

  return fallback();
}

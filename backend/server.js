// Thin AI proxy. Holds ANTHROPIC_API_KEY/GROQ_API_KEY server-side so they are
// never shipped to the browser. This is the only backend responsibility -
// Firebase Auth/Firestore stay as direct client SDK calls in the frontend,
// as designed.
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Node has no implicit .env loading - without this, ANTHROPIC_API_KEY/
// GROQ_API_KEY stay undefined even with a correctly filled .env file, and
// every AI call silently falls through to the deterministic fallback.
// Render/production sets real env vars directly, so a missing .env there is fine.
try {
  process.loadEnvFile();
} catch {
  // No .env file present - rely on env vars already set in the environment.
}

const app = express();
const PORT = process.env.PORT || 8787;
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json({ limit: "5mb" }));

// Moderate limit: enough for normal reporting/admin-dashboard use, low enough
// to bound worst-case AI provider cost from a single client.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again in a minute." },
});

// Mirrors issueCategories/priorities in frontend/src/config/regions.js so the
// structured-output schema matches what the frontend expects back.
const ISSUE_CATEGORIES = [
  "Road Damage",
  "Garbage",
  "Streetlight",
  "Waterlogging",
  "Blocked Drain",
  "Water Leak",
  "Electrical",
  "Hostel Maintenance",
  "Sanitation",
  "Broken Furniture",
  "Safety Hazard",
  "Illegal Construction",
  "Stray Animal",
  "Tree / Garden Maintenance",
  "Traffic / Signage",
  "Other",
];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];
const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
const CLASSIFICATION_KEYS = [
  "category",
  "subcategory",
  "priority",
  "severityScore",
  "summary",
  "aiSuggestedDepartment",
  "recommendedAction",
  "tags",
  "confidence",
  "risks",
  "civicImpactScore",
  "imageObservations",
  "duplicateContext",
];

const CLASSIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: CLASSIFICATION_KEYS,
  properties: {
    category: { type: "string", enum: ISSUE_CATEGORIES },
    subcategory: { type: "string", description: "A more specific label within the category, e.g. 'sunken manhole' for Road Damage." },
    priority: { type: "string", enum: PRIORITIES },
    severityScore: { type: "integer", description: "Severity from 1 (trivial) to 10 (emergency)." },
    summary: { type: "string", description: "One or two sentence civic summary of the issue." },
    aiSuggestedDepartment: { type: "string", description: "The department that seems responsible, for admin transparency only." },
    recommendedAction: { type: "string", description: "A short, concrete next step for the responsible department." },
    tags: { type: "array", items: { type: "string" } },
    confidence: { type: "number", description: "Classification confidence from 0 to 1." },
    risks: {
      type: "object",
      additionalProperties: false,
      required: ["publicHealth", "safety", "environmental", "traffic"],
      properties: {
        publicHealth: { type: "string", enum: RISK_LEVELS },
        safety: { type: "string", enum: RISK_LEVELS },
        environmental: { type: "string", enum: RISK_LEVELS },
        traffic: { type: "string", enum: RISK_LEVELS },
      },
    },
    civicImpactScore: { type: "integer", description: "Overall civic impact from 0 (negligible) to 100 (city-wide emergency)." },
    imageObservations: { type: "string", description: "What is visibly observed in the attached photo, if one was provided." },
    duplicateContext: { type: "string", description: "Any hint from the description that this might be a recurring or already-reported issue." },
  },
};

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isOptionalString(value, maxLength) {
  return value === undefined || value === null || (typeof value === "string" && value.length <= maxLength);
}

async function callAnthropicClassify({ description, imageData, zoneName, regionName }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const promptText = `You are triaging a civic complaint for ${regionName || "the city"}${zoneName ? ` (${zoneName})` : ""}. Description: ${description}`;
  const content = [{ type: "text", text: promptText }];
  if (imageData) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: imageData.split(",")[1] || imageData },
    });
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      output_config: { effort: "low", format: { type: "json_schema", schema: CLASSIFICATION_SCHEMA } },
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic classify request failed (${response.status}): ${errorBody}`);
  }
  const data = await response.json();
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no classification text.");
  return JSON.parse(text);
}

// Groq's vision-capable models don't guarantee strict JSON-schema output like
// Anthropic's structured output, so we ask for JSON object mode plus an
// explicit schema description in the prompt, and validate the shape here.
async function callGroqClassify({ description, imageData, zoneName, regionName }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const instructions = `You are triaging a civic complaint for ${regionName || "the city"}${zoneName ? ` (${zoneName})` : ""}. Description: ${description}\n\nRespond with ONLY a JSON object with these exact keys: ${CLASSIFICATION_KEYS.join(", ")}. "category" must be one of ${JSON.stringify(ISSUE_CATEGORIES)}. "priority" must be one of ${JSON.stringify(PRIORITIES)}. "risks" must be an object with keys publicHealth, safety, environmental, traffic, each one of ${JSON.stringify(RISK_LEVELS)}. "severityScore" is an integer 1-10, "civicImpactScore" is an integer 0-100, "confidence" is a number 0-1, "tags" is an array of strings.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: instructions }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq classify request failed (${response.status}): ${errorBody}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no classification text.");
  const parsed = JSON.parse(text);
  if (!CLASSIFICATION_KEYS.every((key) => key in parsed)) {
    throw new Error("Groq classification response missing required keys.");
  }
  return parsed;
}

async function callAnthropicBriefing({ stats, region }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 400,
      output_config: { effort: "low" },
      messages: [
        {
          role: "user",
          content: `Write a 2-3 sentence civic intelligence briefing for ${region.name} municipal administrators using only these already-computed statistics (do not invent any numbers not given here): ${JSON.stringify(stats)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic briefing request failed (${response.status}): ${errorBody}`);
  }
  const data = await response.json();
  const text = data.content?.find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no briefing text.");
  return text;
}

async function callGroqBriefing({ stats, region }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: `Write a 2-3 sentence civic intelligence briefing for ${region.name} municipal administrators using only these already-computed statistics (do not invent any numbers not given here): ${JSON.stringify(stats)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq briefing request failed (${response.status}): ${errorBody}`);
  }
  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq returned no briefing text.");
  return text;
}

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/ai/classify", aiLimiter, async (req, res) => {
  const { description, imageData, zoneName, regionName } = req.body || {};

  if (!isNonEmptyString(description, 2000)) {
    res.status(400).json({ error: "description is required and must be a string up to 2000 characters." });
    return;
  }
  if (!isOptionalString(imageData, 4_500_000)) {
    res.status(400).json({ error: "imageData must be a base64 string." });
    return;
  }
  if (!isOptionalString(zoneName, 200) || !isOptionalString(regionName, 200)) {
    res.status(400).json({ error: "zoneName and regionName must be short strings." });
    return;
  }

  const request = { description, imageData, zoneName, regionName };

  try {
    const result = await callAnthropicClassify(request);
    if (result) {
      res.json(result);
      return;
    }
  } catch (error) {
    console.error("Anthropic classify failed, trying Groq fallback.", error);
  }

  try {
    const result = await callGroqClassify(request);
    if (result) {
      res.json(result);
      return;
    }
  } catch (error) {
    console.error("Groq classify fallback failed.", error);
  }

  res.status(502).json({ error: "AI classification is currently unavailable." });
});

app.post("/ai/briefing", aiLimiter, async (req, res) => {
  const { stats, region } = req.body || {};

  if (!stats || typeof stats !== "object" || !region || typeof region !== "object" || !isNonEmptyString(region.name, 200)) {
    res.status(400).json({ error: "stats and region (with a name) are required." });
    return;
  }

  const request = { stats, region };

  try {
    const text = await callAnthropicBriefing(request);
    if (text) {
      res.json({ text });
      return;
    }
  } catch (error) {
    console.error("Anthropic briefing failed, trying Groq fallback.", error);
  }

  try {
    const text = await callGroqBriefing(request);
    if (text) {
      res.json({ text });
      return;
    }
  } catch (error) {
    console.error("Groq briefing fallback failed.", error);
  }

  res.status(502).json({ error: "AI briefing is currently unavailable." });
});

app.listen(PORT, () => {
  console.log(`Nagar Setu backend listening on port ${PORT}`);
});

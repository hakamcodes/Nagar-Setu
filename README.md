# Nagar Setu

**AI-powered civic complaint intelligence for Bhopal Municipal Corporation.**


---

## What it does

Nagar Setu turns a citizen's phone photo into a fully triaged, department-routed civic
complaint in under a minute:

1. Citizen snaps a photo + short description of an issue (pothole, garbage, streetlight, etc.)
2. App captures GPS, detects the real Bhopal **ward/zone** via polygon geofencing, and reverse-geocodes the address
3. Claude AI classifies category/subcategory, severity, civic impact, risk tags, and recommended action
4. Deterministic rules (never AI) route the complaint to the correct department and calculate SLA
5. Duplicate/cluster detection groups repeat reports into hotspots
6. Admins get a real-time civic command-center dashboard with zone-wise officer hierarchy, SLA escalation, and an AI-narrated briefing



## Architecture

Two independent apps, one repo:

| App | Stack | Role |
|---|---|---|
| `frontend/` | React + Vite, Firebase Auth/Firestore | Citizen + admin SPA, deployed to Vercel |
| `backend/` | Express (thin proxy) | Holds `ANTHROPIC_API_KEY` server-side, deployed to Render |

### Region-agnostic core
Everything scoped by `regionId`. **Bhopal** (real ward/zone polygons) is the active
production region. Ward/zone containment uses `@turf/boolean-point-in-polygon` against
GeoJSON generated from source data via `scripts/convert-bhopal-gis.mjs`.

### AI usage boundary
Claude (Anthropic Messages API) is used **only** for: category/subcategory classification,
priority/severity/civic-impact scoring, risk tags, recommended action, suggested department,
and narrating the admin briefing over already-computed stats.

Deterministic (never AI): GPS capture, ward/zone polygon detection, **final department
routing**, permissions, SLA calculation, duplicate/cluster scoring.

Call path with graceful fallback:
```
frontend -> backend proxy (ANTHROPIC_API_KEY stays server-side)
         -> direct Anthropic call from browser (if backend unreachable)
         -> deterministic heuristic (if AI unreachable)
```
App stays fully functional through every stage.

### Officer hierarchy
- **Super Admin** — city-wide access, manages officer roster
- **Senior/Zone Officer** — owns one Bhopal zone, assigns to juniors, SLA breach alerts
- **Junior/Field Officer** — sees only assigned complaints, must upload resolution photo to close

SLA escalation is deterministic: overdue complaints escalate to zone senior officer, then
to Super Admin if still open. In-app notifications only (bell icon), no email/SMS.

### Duplicate detection & clustering
New complaints compared against existing ones on ward, zone, category, GPS distance,
description similarity, recency, and image similarity, producing a duplicate-match %.
Mutually-matching complaints above a threshold form hotspot clusters shown on the map
and admin dashboard.

---

## Running locally

### Backend
```bash
cd backend
cp .env.example .env   # fill in ANTHROPIC_API_KEY
npm install
npm run dev             # node --watch server.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev              # Vite dev server
```

To route AI calls through your local backend instead of the browser fallback, set in
`frontend/.env`:
```
VITE_BACKEND_API_BASE_URL=http://localhost:8787
```

Other frontend env vars: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
`VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_ANTHROPIC_API_KEY`,
`VITE_ANTHROPIC_MODEL`, `VITE_ADMIN_EMAILS`, `VITE_DEFAULT_REGION_ID`,
`VITE_PROTOTYPE_MODE`. See `frontend/.env.example`.

Backend env vars: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ALLOWED_ORIGIN`.
See `backend/.env.example`.

> Any `VITE_`-prefixed variable is bundled into client JS and publicly readable —
> never put a secret meant to stay server-side behind a `VITE_` prefix.

---

## Tech stack

- **Frontend:** React, Vite, Firebase Auth/Firestore, Leaflet, Turf.js
- **AI:** Anthropic Claude (Messages API)
- **Backend:** Express (stateless proxy)
- **Geocoding:** OpenStreetMap Nominatim (no API key required)
- **Deploy:** Frontend on Vercel/Netlify, backend on Render

---

## Known limitations

- Complaint visibility by zone/assignment is enforced **client-side only** in parts of
  the app flow — see `firestore.rules` for the current server-side security rules.
- Complaint images are stored as base64 strings directly on the Firestore complaint
  record, not object storage — acceptable for prototype scale, not production scale.

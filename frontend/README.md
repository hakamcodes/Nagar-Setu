# Nagar Setu

**A cloud-native civic-intelligence and complaint-resolution platform, piloted on Bhopal for the Claude Impact Lab.**

Nagar Setu helps citizens report civic issues and helps municipal authorities resolve them faster. A user uploads a photo, adds a short description, allows GPS location, and submits a complaint in under a minute. The system automatically detects the real municipal ward and zone, reverse-geocodes the address, classifies the issue with AI, checks for duplicates and clusters, routes it to the correct Bhopal Municipal Corporation (BMC) department, and gives admins a civic command-center dashboard.



## Problem Statement

People regularly face local issues such as potholes, garbage, broken streetlights, waterlogging, blocked drains, electrical faults, and sanitation problems. In most cases, they do not know the correct department to contact, complaints are repeated, and authorities receive scattered information without location, priority, or proper tracking.

Nagar Setu solves this by turning simple public complaints into structured, mapped, deduplicated, and prioritized civic intelligence.

## Key Features

- **Fast issue reporting** with photo, description, and automatic GPS capture
- **Real ward/zone detection** using point-in-polygon containment against actual Bhopal ward and zone boundaries (2024 official LGD ward data + BMC zone boundaries) - no manual zone picking, no invented boundaries
- **Reverse geocoding** (OpenStreetMap Nominatim) for road, locality, and formatted address
- **AI-based classification** (Anthropic Claude) for category, subcategory, priority, severity score, summary, tags, risk indicators (public health, safety, environmental, traffic), civic impact score, recommended action, and a suggested department - with a deterministic heuristic fallback when AI is unavailable
- **Deterministic BMC department routing** - the AI may suggest a department for transparency, but a configurable category-to-department map always decides the department actually stored on a complaint
- **Duplicate detection and clustering** using ward/zone, category, GPS distance, description similarity, recency, and a lightweight image-similarity signal, surfaced as a duplicate-match percentage
- **Support/voting system** so users can mark "I also face this issue"
- **Public complaint feed and live map** with ward/zone boundary overlays and status/category/priority/ward filters
- **Admin civic command center**: SLA tracking and breach alerts, department performance, ward/zone analytics, hotspot clustering, 7-day emerging-hotspot trends, complaint/officer assignment, and an AI-generated civic briefing
- **Region-agnostic architecture** ready for additional cities or campuses

## Pilot Region: Bhopal

The active region is **Bhopal, Madhya Pradesh, India** (Bhopal Municipal Corporation). Ward and zone boundaries come from real, verifiable sources checked into `data/`:

- `data/dataSet.kml` - 2024 official LGD ward boundaries (85 wards)
- `data/Bhopal/Bhopal_wards.geojson` - BMC informative-map wards (zone numbers, corporator and ward-officer contacts, population)
- `data/Bhopal/Zone_Boundary.geojson` - real BMC zone polygons with zone officer contacts
- `data/Bhopal/Planning_ Boundary_ 2031.geojson` - Bhopal city planning-limit polygon
- `data/Bhopal/Ward_Offices.geojson`, `Zone_Offices.geojson` - office point locations

`scripts/convert-bhopal-gis.mjs` normalizes and cross-references these into the files the app actually loads at runtime, under `public/gis/bhopal/`. Re-run it (`node scripts/convert-bhopal-gis.mjs`) whenever the source files in `data/` are updated.

## Tech Stack

### Frontend

- **React.js**, **Vite**, **Tailwind CSS**, **React Router**, **Lucide React Icons**

### Backend / Database

- **Firebase Authentication**, **Cloud Firestore**, Firestore Security Rules
- Prototype support for local/demo mode (localStorage)

### AI

- **Anthropic Claude API** (Messages API, structured JSON output, vision for the uploaded complaint photo), with Groq as a silent server-side backup
- Used for category/subcategory, priority, severity score, summary, tags, risk indicators, civic impact score, recommended action, and a suggested department
- All AI calls go through the `backend/` proxy (`VITE_BACKEND_API_BASE_URL`), which holds the provider API keys - the browser never calls Anthropic/Groq directly. A deterministic heuristic fallback covers the case where the backend is unset or unavailable.

### GIS and Location

- **Leaflet.js** + **OpenStreetMap** tiles
- **Browser Geolocation API** for GPS capture
- **@turf/boolean-point-in-polygon** for deterministic ward/zone containment against real GeoJSON boundaries
- **OpenStreetMap Nominatim** for reverse geocoding (free, no API key)

### Deployment and Version Control

- **Vercel** for deployment (`vercel.json` included, with an SPA rewrite for React Router)
- **GitHub** for version control and submission
- Environment variables for Firebase credentials; AI provider credentials live only in `backend/`, never in the frontend

## Main User Flow

1. User signs in.
2. User clicks **Report Issue**, uploads a photo, and writes a short description.
3. App captures GPS location.
4. App detects the real ward and zone via polygon containment and reverse-geocodes the address.
5. AI classifies the complaint and suggests a department; the deterministic department map decides the department actually stored.
6. App checks for duplicate/likely-clustered complaints and shows a match percentage.
7. If a duplicate exists, the user can support the existing issue instead of creating a new one.
8. If new, the complaint is created with full geographic and AI intelligence attached, and is publicly trackable.

## Admin Flow and Officer Hierarchy

Admin access is a three-tier chain of command, not a single flat role:

- **Super Admin** - identity comes from `VITE_ADMIN_EMAILS`. Sees and can act on everything city-wide, and manages the officer roster from a "Manage Officers" screen.
- **Senior / Zone Officer** - owns one real Bhopal zone (from the actual BMC zone boundaries). Sees every complaint in that zone, assigns it to a junior officer, and gets notified when something in the zone breaches its SLA.
- **Junior / Field Officer** - sees only complaints assigned to them, must upload a resolution photo before a complaint can move to Resolved, and can return a wrongly-routed complaint to their senior officer.

Senior and junior officers are **not** environment-variable driven - they are added by the Super Admin at `/admin/officers`, so new officers (e.g. a colleague's email) can be added without a redeploy.

Complaints escalate automatically and deterministically (no AI involved) when a deadline is missed: once the SLA due date passes, the complaint is flagged for its zone's senior officer; if it stays open for as long again past that, it's flagged for the Super Admin. Notifications for assignment, escalation, and bounce-back are **in-app only** (a bell icon in the header) - no email/SMS integration yet.

1. Officer signs in with their own email and opens the civic command-center dashboard, scoped to their tier (their zone, their assignments, or everything for Super Admin).
2. Dashboard shows total/open/in-progress/resolved/overdue counts, high-priority and SLA-breach counts, average civic impact score, hotspot count, and officer performance.
3. Officer reviews the ward-wise/zone-wise map and analytics, department performance, and emerging-hotspot trends.
4. Senior/Super Admin assigns complaints to officers; officers update status, add internal notes, and upload resolution proof.

Server-side enforcement of this hierarchy lives in `firestore.rules` (deploy with `firebase deploy --only firestore:rules`) - the client-side checks above are a UX convenience, not the security boundary.

## AI Usage

AI is used only where it adds real value: issue understanding, severity/risk assessment, department suggestion, civic impact scoring, and narrating the admin briefing over already-computed statistics.

Deterministic logic (never delegated to AI) is used for: GPS capture, ward/zone polygon detection, final department routing, database storage, permissions, status updates, SLA calculation, and duplicate/cluster scoring rules.

## Duplicate Detection and Clustering

Nagar Setu checks whether a new complaint is similar to an existing one by comparing ward, zone, category, GPS distance, description similarity, recency, and (when both have photos) a lightweight image-similarity signal, producing a duplicate-match percentage. Complaints that mutually score above a clustering threshold are grouped into hotspot clusters shown on the admin dashboard.

## Image Storage Note

For this prototype, complaint images are compressed in the browser and stored as **Base64 strings** with the complaint record in Firestore. This is suitable for demo and hackathon prototype mode. For production scale, images should move to object storage (Firebase Storage, Cloud Storage, or S3) with Firestore storing only metadata and image URLs.

## Environment Variables

Create a `.env` file using `.env.example`:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

VITE_BACKEND_API_BASE_URL=
VITE_ADMIN_EMAILS=admin@example.com

VITE_DEFAULT_REGION_ID=bhopal
VITE_PROTOTYPE_MODE=true
```

Reverse geocoding (Nominatim) needs no API key.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite.

## Build for Production

```bash
npm run build
```

The production build is generated in the `dist` folder.

## Deployment

The app can be deployed on **Vercel**:

1. Push the project to GitHub.
2. Connect the GitHub repository to Vercel, with `frontend` as the project root.
3. `vercel.json` already sets the SPA rewrite React Router needs.
4. Add all required environment variables in the Vercel project settings, including `VITE_BACKEND_API_BASE_URL` pointing at the deployed `backend/`.

## Why This Project Stands Out

Nagar Setu is not just a complaint form. It is a cloud-native civic-intelligence system built for the Claude Impact Lab: real municipal ward/zone geography, AI-driven triage and risk scoring, deterministic department routing, duplicate/cluster intelligence, live maps, and an admin command center with SLA tracking — all working together on real Bhopal Municipal Corporation data.

## Future Scope

- Multi-city deployment beyond Bhopal
- Stronger admin role hierarchy
- Push notifications for complaint updates
- Resolution before/after images
- CSV/PDF analytics export
- PWA mobile install support
- Production object storage for images
- Department-wise staff accounts
- Public authority performance reports

## One-Line Pitch

**Nagar Setu lets Bhopal residents report civic issues in under one minute and helps BMC departments resolve them through real ward/zone geography, AI-powered risk triage, duplicate/cluster detection, live maps, and admin analytics — built for the Claude Impact Lab.**

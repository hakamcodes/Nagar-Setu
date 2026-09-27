<div align="center">

# 🏙️ Nagar Setu — नगर सेतु

### *Your city. Your voice. Tracked.*

**An AI-powered civic complaint intelligence platform for Bhopal Municipal Corporation**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-nagarsetubhopal.vercel.app-0f766e?style=for-the-badge)](https://nagarsetubhopal.vercel.app)
[![Built with React](https://img.shields.io/badge/React-Vite-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Powered by Claude AI](https://img.shields.io/badge/AI-Anthropic_Claude-orange?style=for-the-badge)](https://anthropic.com)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFCA28?style=for-the-badge&logo=firebase)](https://firebase.google.com)

</div>

---

## 🚩 What is Nagar Setu?

**Nagar Setu** (meaning *"Bridge of the City"* in Hindi) is a smart civic platform that helps citizens of Bhopal report local problems — like potholes, broken streetlights, garbage overflow, or drainage issues — directly to the right government department, in under 60 seconds.

No phone calls. No long forms. No confusion about which office to contact.

Just take a photo → let AI and GPS do the work → track your complaint in real time.

---

## 🖼️ Screenshots

| Home — Live Feed | Report an Issue | Live Complaints |
|:---:|:---:|:---:|
| ![Home Page](img/Screenshot%202026-09-27%20113043.png) | ![Report Issue](img/Screenshot%202026-09-27%20113239.png) | ![Complaints Feed](img/Screenshot%202026-09-27%20113255.png) |

| Interactive Map | Admin Dashboard | How It Works |
|:---:|:---:|:---:|
| ![Map Page](img/Screenshot%202026-09-27%20113305.png) | ![Admin Dashboard](img/Screenshot%202026-09-27%20113326.png) | ![Steps](img/Screenshot%202026-09-27%20113349.png) |

---

## ✨ Key Features

### 📸 1. Report an Issue in Under 60 Seconds

Citizens can file a complaint in three simple steps:

1. **Take a live photo** of the problem (potholes, broken lights, garbage, drainage, etc.)
2. **Capture GPS location** — the app auto-detects your exact ward and zone using real Bhopal boundary maps
3. **Submit** — AI classifies the issue and routes it to the correct department automatically

> Gallery uploads are disabled to ensure authenticity. Only live photos are accepted as evidence.

---

### 🤖 2. AI-Powered Triage (Powered by Claude)

When you submit a complaint, Anthropic's Claude AI reads the photo and description and automatically figures out:

| What AI Does | Example |
|---|---|
| **Category & Subcategory** | `Electrical → Damaged Streetlight` |
| **Priority Level** | `Critical / High / Medium / Low` |
| **Severity Score** | `7/10` |
| **Civic Impact Score** | `58/100` |
| **Risk Tags** | `Electrocution risk, Falling debris` |
| **Suggested Department** | `Municipal Corporation - Street Lighting` |
| **Confidence %** | `93%` |
| **Recommended Action** | Short summary of what needs to be done |

If AI confidence is low (under 65%), the citizen can manually correct the category before submitting.

**Important:** AI only *suggests* — the final department routing and SLA deadlines are always determined by fixed rules, never by AI alone. This ensures accountability.

---

### 📍 3. Real Ward & Zone Detection

Bhopal is divided into **wards** and **zones**. Nagar Setu uses real Bhopal Municipal Corporation GIS boundary data to automatically detect:

- Which **ward** (e.g., Ward 39 – Naveen Nagar) the complaint belongs to
- Which **zone** it falls under
- The full **address** (locality, road name) via OpenStreetMap

This means citizens don't need to know or remember which ward they live in. The system figures it out from their GPS or photo metadata (EXIF location).

**Three ways to set location:**
- 📡 Auto-detect via GPS
- 🗺️ Pick a point on the interactive map
- 📷 Extracted automatically from photo EXIF data

---

### 🎙️ 4. Voice Input — Hindi & English

Citizens can describe their issue by speaking instead of typing. The voice input feature supports:

- 🇮🇳 **Hindi** (`hi-IN`) — for local residents who prefer Hindi
- 🇬🇧 **English** — toggle with a single button

The app transcribes speech in real time and appends it to the description field. Works entirely in the browser using the Web Speech API — no third-party service needed.

---

### 🔁 5. Smart Duplicate Detection

Before submitting, the app checks if a similar complaint already exists nearby. It compares:

- Same ward & zone
- Same category
- GPS distance (are they near each other?)
- Description similarity
- How recently it was reported
- Image similarity (via hashing)

If a likely duplicate is found (with a match percentage shown), the citizen is offered two choices:
- **Support the existing complaint** — adds their voice to raise its priority
- **File separately** — if it's genuinely a different issue

This keeps the system clean and prevents multiple officers from working on the same problem.

---

### 👥 6. Community Support System

Every complaint has a **"Support"** button. When multiple citizens support the same issue, its civic impact score rises and it gets bumped higher in the admin's queue.

This turns Nagar Setu into a democratic tool — the problems that affect the most people get attention first.

---

### 📂 7. Save as Draft

In a hurry? Take a photo now and submit the description later.

- Snap a photo → tap **"Save as incomplete draft"**
- Come back to it anytime from **My Complaints**
- GPS location and photo are saved locally until you're ready

---

### 🗺️ 8. Live Interactive Map

The **Map page** shows all reported complaints plotted on a real map of Bhopal, with ward and zone boundaries drawn.

Filter complaints by:
- Status (Open / In Progress / Resolved)
- Category (Road, Electrical, Sanitation, etc.)
- Priority level
- Specific ward

This gives both citizens and officers a visual picture of where problems are concentrated.

---

### 🔔 9. In-App Notifications

Citizens get notified when:
- A new issue is reported in their **home ward**
- Their complaint status changes

Officers get notified when:
- A complaint is assigned to them
- A complaint breaches its SLA deadline

Notifications appear as a bell icon in the top bar. No emails or SMS — everything is in-app.

---

### 🛡️ 10. Admin Command Center

The **Admin Dashboard** is a real-time civic operations center for municipal staff. It shows:

#### 📊 Live Stats Panel
| Metric | Description |
|---|---|
| Total | Total complaints in the system |
| Open | Awaiting action |
| In Progress | Being worked on |
| Resolved | Completed |
| High Priority | Needs urgent attention |
| SLA Breached | Overdue complaints |
| Avg Civic Impact | Average score across all complaints |
| Hotspots | Clusters of repeated complaints in one area |

#### 🤖 AI Civic Briefing
Claude AI auto-generates a plain-English daily briefing for admins — like a morning report summarizing open issues, high-priority alerts, SLA status, and which ward needs the most field attention.

#### 📍 Hotspot Map
Unresolved complaints are plotted on a map. Clusters automatically form "hotspots" where multiple similar complaints are concentrated in the same area. Officers can deploy field teams to these hotspots directly.

#### 📈 Analytics Panels
- **Complaints by Ward** — bar chart of which wards have the most issues
- **Priority Breakdown** — how many Critical/High/Medium/Low complaints exist
- **Department Performance** — resolution rate and average resolution time per department
- **7-Day Trend** — which areas are seeing a rise in complaints

#### 👮 Officer Management
Admins can manage the officer hierarchy:
- **Super Admin** — city-wide access, manages the full officer roster
- **Senior/Zone Officer** — responsible for one Bhopal zone, assigns complaints to junior officers
- **Junior/Field Officer** — sees only complaints assigned to them, must upload a resolution photo to close a case

---

### ⏱️ 11. SLA (Service Level Agreement) Enforcement

Every complaint gets a deadline based on its priority and category. If a complaint is not resolved in time:

1. It **escalates automatically** to the zone's senior officer
2. If still unresolved, it escalates further to the **Super Admin**

This ensures no complaint gets lost or ignored indefinitely.

---

### 🌐 12. Bilingual Interface (English + हिंदी)

The entire app is available in **English and Hindi**. Users can switch languages from the Settings page. The language toggle affects all navigation labels, page titles, and voice recording prompts.

---

### 💾 13. My Complaints — Track Your History

Every citizen has a **"My Complaints"** page that shows:
- All submitted complaints with their current status
- Incomplete drafts waiting to be finished
- A timeline of updates on each complaint

---

## 🔧 How It Works — Architecture

```
Citizen → Takes photo + description
        → GPS captures location
        → Ward/zone auto-detected via GIS polygon matching
        → Claude AI classifies category, severity, risk, department
        → Duplicate check against existing complaints
        → Submitted to Firestore (Firebase)

Admin   → Sees all complaints in real-time dashboard
        → Assigns to zone officers
        → Tracks SLA breaches
        → Gets AI-generated daily briefing
```

The app uses a **graceful fallback** for AI calls:
1. First tries the backend proxy (keeps the API key server-side)
2. Falls back to a direct browser call if backend is down
3. Falls back to a smart heuristic classifier if AI is completely unreachable

**The app always works, even without internet AI access.**

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, TailwindCSS |
| **Backend** | Express.js (thin API proxy) |
| **Database** | Firebase Firestore |
| **Auth** | Firebase Authentication (Google + Email) |
| **AI** | Anthropic Claude (Messages API) |
| **Maps** | Leaflet.js with OpenStreetMap tiles |
| **GIS / Polygons** | Turf.js (`@turf/boolean-point-in-polygon`) |
| **Geocoding** | OpenStreetMap Nominatim (free, no API key) |
| **Voice Input** | Web Speech API (built into browser) |
| **Deploy** | Vercel (frontend), Render (backend) |

---

## 🚀 Running Locally

### Backend
```bash
cd backend
cp .env.example .env   # Add your ANTHROPIC_API_KEY
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

To use the local backend instead of the browser fallback, add this to `frontend/.env`:
```
VITE_BACKEND_API_BASE_URL=http://localhost:8787
```

### Environment Variables (Frontend)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_ANTHROPIC_API_KEY
VITE_ANTHROPIC_MODEL
VITE_ADMIN_EMAILS
VITE_DEFAULT_REGION_ID
VITE_PROTOTYPE_MODE
```

> ⚠️ Never put a secret API key behind a `VITE_` prefix — anything prefixed with `VITE_` is bundled into client-side JavaScript and visible to everyone. Use the backend proxy for secrets.

---

## 🗺️ Project Structure

```
Nagar Setu/
├── frontend/
│   └── src/
│       ├── pages/           # All page components (Home, Report, Map, Admin, etc.)
│       ├── components/      # Reusable UI, map, and complaint components
│       ├── services/        # AI, analytics, geo, duplicate detection logic
│       ├── config/          # Bhopal departments, ward/zone data, SLA rules
│       ├── state/           # React context (Auth, Data, Region, Toast)
│       ├── i18n/            # English & Hindi translations
│       └── utils/           # Date, geo, image, text helpers
├── backend/
│   └── server.js            # Express proxy for Anthropic API
├── img/                     # Screenshots for README
└── firestore.rules          # Firestore security rules
```

---

## 🌍 Region-Agnostic Design

Although currently piloted in **Bhopal** with real ward/zone GIS data, Nagar Setu is designed to work for **any Indian city**. A new city can be added simply by:
- Adding its GIS boundary polygons
- Configuring department names
- Setting a new `regionId`

No code changes needed to onboard a new city.

---

## 🔗 Live Demo

> **Try it live:** [https://nagarsetubhopal.vercel.app](https://nagarsetubhopal.vercel.app)

**Demo login options (no signup needed):**
- 👤 Demo Citizen — report and track complaints
- 👮 Demo Junior Officer — handle assigned complaints
- 🏛️ Demo Senior Officer — zone-level management
- 🔑 Demo Super Admin — full city-wide access

---

<div align="center">

**Built with ❤️ for Bhopal — making civic governance smarter, faster, and more accountable.**

</div>

import { Clock, Home, Inbox, LocateFixed, MapPinned, Search, Sparkles, UserPlus } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";
import LocationPickerModal from "../components/map/LocationPickerModal.jsx";
import { complaintStatuses, getRegion, issueCategories } from "../config/regions.js";
import { resolveLocationIntelligence } from "../services/geoService.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useRegion } from "../state/RegionContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { getBrowserLocation } from "../utils/geo.js";
import { useT } from "../i18n/useT.js";

// ─── Smart scoring ─────────────────────────────────────────────────────────────
// Ward issues get a large fixed boost so they always lead.
// Within each tier, higher civic impact + more supporters + recency wins.
function scoreComplaint(complaint, userWardNumber) {
  const hoursOld = (Date.now() - new Date(complaint.createdAt).getTime()) / 3_600_000;
  const isMyWard = !!(userWardNumber && complaint.ward?.number === userWardNumber);
  return (
    (isMyWard ? 10_000 : 0) +
    (complaint.aiCivicImpactScore || 0) * 8 +          // 0 – 800
    Math.min((complaint.supportCount || 0) * 15, 500) - // 0 – 500 (capped)
    Math.min(hoursOld, 720) * 0.5                       // recency penalty, max −360
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ComplaintFeed() {
  const { user, isAuthenticated, updateHomeLocation } = useAuth();
  const { complaints, loading } = useData();
  const { activeRegion } = useRegion();
  const { showToast } = useToast();
  const t = useT();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sortMode, setSortMode] = useState("smart"); // "smart" | "newest"

  // Ward setup banner state
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [guestBannerDismissed, setGuestBannerDismissed] = useState(false);

  const userWardNumber = user?.homeWard?.number ?? null;
  const region = getRegion(user?.regionPreference || activeRegion);

  // ── Filter & sort ─────────────────────────────────────────────────────────
  const regionComplaints = useMemo(
    () => complaints.filter((item) => !item.regionId || item.regionId === activeRegion),
    [activeRegion, complaints],
  );

  const { myWardComplaints, otherComplaints } = useMemo(() => {
    const needle = query.toLowerCase();
    const base = regionComplaints
      .filter((item) => !status || item.status === status)
      .filter((item) => !category || item.aiCategory === category)
      .filter((item) =>
        !needle ||
        `${item.description} ${item.aiSummary} ${item.zoneName}`.toLowerCase().includes(needle),
      );

    if (sortMode === "newest") {
      const sorted = [...base].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return { myWardComplaints: [], otherComplaints: sorted };
    }

    // Smart sort — score every complaint, then split into ward vs rest
    const sorted = [...base].sort(
      (a, b) => scoreComplaint(b, userWardNumber) - scoreComplaint(a, userWardNumber),
    );

    if (!userWardNumber) {
      return { myWardComplaints: [], otherComplaints: sorted };
    }

    return {
      myWardComplaints: sorted.filter((c) => c.ward?.number === userWardNumber),
      otherComplaints: sorted.filter((c) => c.ward?.number !== userWardNumber),
    };
  }, [category, query, regionComplaints, sortMode, status, userWardNumber]);

  const totalFiltered = myWardComplaints.length + otherComplaints.length;

  // ── Ward setup via GPS ────────────────────────────────────────────────────
  const detectWardByGps = useCallback(async () => {
    setLocating(true);
    try {
      const gps = await getBrowserLocation();
      const intel = await resolveLocationIntelligence(gps, region);
      if (intel.ward) {
        updateHomeLocation(intel.ward, gps.latitude, gps.longitude);
        showToast(`Home ward set: Ward ${intel.ward.number} – ${intel.ward.name}`);
        setBannerDismissed(true);
      } else {
        showToast("Could not detect a ward here. Try picking on the map.", "error");
      }
    } catch (error) {
      showToast(error.message || "Location permission denied.", "error");
    } finally {
      setLocating(false);
    }
  }, [region, showToast, updateHomeLocation]);

  // ── Ward setup via map ────────────────────────────────────────────────────
  const handleMapPick = useCallback(
    async (coords) => {
      setShowMapPicker(false);
      showToast("Detecting ward from map location…");
      try {
        const intel = await resolveLocationIntelligence(coords, region);
        if (intel.ward) {
          updateHomeLocation(intel.ward, coords.latitude, coords.longitude);
          showToast(`Home ward set: Ward ${intel.ward.number} – ${intel.ward.name}`);
          setBannerDismissed(true);
        } else {
          showToast("That location is outside mapped ward boundaries.", "error");
        }
      } catch (error) {
        showToast(error.message || "Could not resolve location.", "error");
      }
    },
    [region, showToast, updateHomeLocation],
  );

  const showWardBanner = isAuthenticated && !user?.homeWard && !bannerDismissed;
  const showGuestBanner = !isAuthenticated && !guestBannerDismissed;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showMapPicker && (
        <LocationPickerModal
          initialCenter={
            user?.homeLat
              ? { latitude: user.homeLat, longitude: user.homeLng }
              : { latitude: region.defaultCenterLat, longitude: region.defaultCenterLng }
          }
          onConfirm={handleMapPick}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <section className="section">
        {/* ── Page header ── */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">{t.feedEyebrow}</p>
            <h1 className="page-title">{t.feedTitle}</h1>
            {!loading && (
              <p className="mt-2 text-sm font-semibold text-slate-500">
                {t.feedShown(totalFiltered, regionComplaints.length)}
              </p>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[700px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} />
              <input
                className="field pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.feedSearch}
              />
            </label>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t.feedAllStatuses}</option>
              {complaintStatuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{t.feedAllCategories}</option>
              {issueCategories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Sort mode toggle ── */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSortMode("smart")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              sortMode === "smart"
                ? "bg-civic text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <Sparkles size={12} />
            {t.feedSortSmart}
          </button>
          <button
            type="button"
            onClick={() => setSortMode("newest")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
              sortMode === "newest"
                ? "bg-civic text-white shadow-sm"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            <Clock size={12} />
            {t.feedSortNewest}
          </button>
          {sortMode === "smart" && (
            <span className="text-xs text-slate-400">
              {user?.homeWard ? t.feedRankedWard : t.feedRankedImpact}
            </span>
          )}
        </div>

        {/* ── Guest sign-up banner ── */}
        {showGuestBanner && (
          <div className="mb-6 overflow-hidden rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white shadow-sm">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-civic to-teal-700 text-white shadow-card">
                  <UserPlus size={18} />
                </span>
                <div>
                  <p className="text-sm font-black text-teal-900">
                    See complaints from your ward first — and report issues yourself
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-teal-700">
                    You're viewing all public complaints. Sign up to get a personalised feed for your home ward, receive notifications, and report issues directly.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Link
                  to="/signin"
                  state={{ signUpMode: true }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-civic px-4 py-2 text-xs font-bold text-white shadow-card transition hover:-translate-y-px hover:bg-teal-800 hover:shadow-glow"
                >
                  <UserPlus size={13} />
                  Sign up free
                </Link>
                <Link
                  to="/signin"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-4 py-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:bg-teal-50"
                >
                  Sign in
                </Link>
                <button
                  type="button"
                  onClick={() => setGuestBannerDismissed(true)}
                  className="text-xs text-teal-400 underline transition hover:text-teal-600"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Ward setup banner ── */}
        {showWardBanner && (
          <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-teal-100 text-civic">
                  <Home size={16} />
                </span>
                <div>
                  <p className="text-sm font-bold text-teal-900">{t.feedWardBannerTitle}</p>
                  <p className="text-xs text-teal-700">{t.feedWardBannerDesc}</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={detectWardByGps}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:bg-teal-100 disabled:opacity-60"
                >
                  <LocateFixed size={13} />
                  {locating ? t.feedDetecting : t.feedUseLocation}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300 bg-white px-3 py-2 text-xs font-semibold text-teal-800 shadow-sm transition hover:bg-teal-100"
                >
                  <MapPinned size={13} />
                  {t.feedPickMap}
                </button>
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="text-xs text-teal-500 underline transition hover:text-teal-700"
                >
                  {t.feedLater}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Complaint list ── */}
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="card h-40 animate-pulse bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">

            {/* My ward section */}
            {myWardComplaints.length > 0 && (
              <>
                <div className="col-span-full flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5">
                  <Home size={15} className="text-civic" />
                  <span className="text-sm font-bold text-civic">
                    Ward {user.homeWard.number} — {user.homeWard.name}
                  </span>
                  <span className="ml-auto text-xs text-teal-600">
                    {t.feedIssues(myWardComplaints.length)}
                  </span>
                </div>
                {myWardComplaints.map((complaint) => (
                  <ComplaintCard
                    key={complaint.complaintId}
                    complaint={complaint}
                    isMyWard
                  />
                ))}
              </>
            )}

            {/* Divider between ward and other issues */}
            {myWardComplaints.length > 0 && otherComplaints.length > 0 && (
              <div className="col-span-full mt-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Sparkles size={15} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-500">{t.feedTopIssues}</span>
              </div>
            )}

            {/* All other (or all, when no homeWard) issues */}
            {otherComplaints.map((complaint) => (
              <ComplaintCard key={complaint.complaintId} complaint={complaint} />
            ))}

            {totalFiltered === 0 && (
              <div className="card col-span-full grid place-items-center gap-3 p-10 text-center text-slate-500">
                <Inbox size={28} className="text-slate-300" />
                {t.feedEmpty}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
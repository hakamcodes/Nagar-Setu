import { Globe, LocateFixed, MapPin, MapPinned, RotateCcw, UserCog } from "lucide-react";
import { useCallback, useState } from "react";
import LocationPickerModal from "../components/map/LocationPickerModal.jsx";
import { resetPrototypeStore } from "../services/prototypeStore.js";
import { getRegion, regions } from "../config/regions.js";
import { resolveLocationIntelligence } from "../services/geoService.js";
import { getBrowserLocation } from "../utils/geo.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useRegion } from "../state/RegionContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { useT } from "../i18n/useT.js";

export default function Settings() {
  const { user, updateHomeLocation, updateUiLang } = useAuth();
  const { activeRegion, setActiveRegion } = useRegion();
  const { showToast } = useToast();
  const t = useT();

  const [showMapPicker, setShowMapPicker] = useState(false);
  const [locating, setLocating] = useState(false);

  const region = getRegion(user?.regionPreference || activeRegion);
  const lang = user?.uiLang ?? "en";

  function reset() {
    resetPrototypeStore();
    showToast("Prototype data reset to the seed demo records.");
  }

  function changeRegion(regionId) {
    setActiveRegion(regionId);
    showToast("Region preference updated.");
  }

  const detectWard = useCallback(async () => {
    setLocating(true);
    try {
      const gps = await getBrowserLocation();
      const intel = await resolveLocationIntelligence(gps, region);
      if (intel.ward) {
        updateHomeLocation(intel.ward, gps.latitude, gps.longitude);
        showToast(`Home ward set: Ward ${intel.ward.number} – ${intel.ward.name}`);
      } else {
        showToast("Could not detect a ward here. Try picking on the map.", "error");
      }
    } catch (error) {
      showToast(error.message || "Location permission denied.", "error");
    } finally {
      setLocating(false);
    }
  }, [region, showToast, updateHomeLocation]);

  const handleMapPick = useCallback(
    async (coords) => {
      setShowMapPicker(false);
      showToast("Detecting ward…");
      try {
        const intel = await resolveLocationIntelligence(coords, region);
        if (intel.ward) {
          updateHomeLocation(intel.ward, coords.latitude, coords.longitude);
          showToast(`Home ward set: Ward ${intel.ward.number} – ${intel.ward.name}`);
        } else {
          showToast("That location is outside mapped ward boundaries.", "error");
        }
      } catch (error) {
        showToast(error.message || "Could not resolve location.", "error");
      }
    },
    [region, showToast, updateHomeLocation],
  );

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

      <section className="section max-w-4xl">
        <p className="eyebrow">{t.settingsEyebrow}</p>
        <h1 className="page-title">{t.settingsTitle}</h1>
        <div className="mt-6 grid gap-5">

          {/* ── Profile ── */}
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <UserCog size={20} className="text-civic" /> {t.settingsProfileTitle}
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-sm font-bold">{t.settingsNameLabel}</span>
                <input className="field" value={user.name} readOnly />
              </label>
              <label>
                <span className="mb-1 block text-sm font-bold">{t.settingsRoleLabel}</span>
                <input className="field capitalize" value={user.role?.replace(/-/g, " ")} readOnly />
              </label>
            </div>
          </div>

          {/* ── Home Ward ── */}
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <MapPin size={20} className="text-civic" /> {t.settingsHomeWardTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{t.settingsHomeWardDesc}</p>

            {user?.homeWard ? (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-teal-900">
                    Ward {user.homeWard.number} — {user.homeWard.name}
                  </p>
                  {user.homeLat != null && (
                    <p className="mt-0.5 text-xs text-teal-700">
                      📍 {Number(user.homeLat).toFixed(5)}, {Number(user.homeLng).toFixed(5)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { updateHomeLocation(null, null, null); showToast("Home ward cleared."); }}
                  className="shrink-0 text-xs text-red-400 transition hover:text-red-600"
                >
                  {t.settingsClearWard}
                </button>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {t.settingsNoWard}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={detectWard} disabled={locating}>
                <LocateFixed size={16} />
                {locating ? t.settingsDetecting : t.settingsUseLocation}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowMapPicker(true)}>
                <MapPinned size={16} />
                {t.settingsPickMap}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">{t.settingsWardHint(region.name)}</p>
          </div>

          {/* ── Region preference ── */}
          <div className="card p-5">
            <h2 className="text-xl font-black">{t.settingsRegionTitle}</h2>
            <select
              className="field mt-4"
              value={activeRegion}
              onChange={(event) => changeRegion(event.target.value)}
            >
              {regions.map((r) => (
                <option key={r.regionId} value={r.regionId}>{r.name}</option>
              ))}
            </select>
            <p className="mt-3 text-sm text-slate-600">{t.settingsRegionHint}</p>
          </div>

          {/* ── Language preference ── */}
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Globe size={20} className="text-civic" /> {t.settingsLangTitle}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{t.settingsLangDesc}</p>
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { updateUiLang("en"); showToast("Language set to English."); }}
                className={`flex-1 rounded-lg border py-3 text-sm font-bold transition ${
                  lang === "en"
                    ? "border-civic bg-civic text-white shadow-card"
                    : "border-slate-200 bg-white text-ink hover:border-civic/60 hover:text-civic"
                }`}
              >
                {t.settingsLangEn}
              </button>
              <button
                type="button"
                onClick={() => { updateUiLang("hi"); showToast("भाषा हिंदी में बदल दी गई।"); }}
                className={`flex-1 rounded-lg border py-3 text-sm font-bold transition ${
                  lang === "hi"
                    ? "border-civic bg-civic text-white shadow-card"
                    : "border-slate-200 bg-white text-ink hover:border-civic/60 hover:text-civic"
                }`}
              >
                {t.settingsLangHi}
              </button>
            </div>
          </div>

          {/* ── Prototype controls ── */}
          <div className="card p-5">
            <h2 className="text-xl font-black">{t.settingsProtoTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{t.settingsProtoDesc}</p>
            <button type="button" className="btn-secondary mt-4" onClick={reset}>
              <RotateCcw size={16} />
              {t.settingsResetBtn}
            </button>
          </div>

        </div>
      </section>
    </>
  );
}

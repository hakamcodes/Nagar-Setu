import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinned,
  Mic,
  MicOff,
  Save,
  Sparkles,
  ThumbsUp,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAreaLabel, getRegion, getZonesForRegion, issueCategories } from "../config/regions.js";
import { classifyComplaint } from "../services/aiService.js";
import { findLikelyDuplicate } from "../services/duplicateService.js";
import { compressImageToBase64, extractExifGps } from "../utils/image.js";
import { getBrowserLocation } from "../utils/geo.js";
import { resolveLocationIntelligence } from "../services/geoService.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { PriorityBadge } from "../components/ui/Badge.jsx";
import { saveDraft } from "../services/complaintRepository.js";
import LocationPickerModal from "../components/map/LocationPickerModal.jsx";

// ─── Voice input hook ─────────────────────────────────────────────────────────
// Uses the Web Speech API in NON-continuous mode (one press = one session).
// Each session gives one clean final transcript — no repeated words.
// Language is set to hi-IN which handles Hinglish (mixed Hindi+English) well.

function useSpeechInput() {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  // Each completed session produces one final string; caller decides how to use it
  const [lastFinal, setLastFinal] = useState(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    // NON-continuous: one session ends naturally after silence → no repeated words
    recognition.continuous = false;
    recognition.interimResults = true;
    // lang is set dynamically in startListening() based on the user's toggle choice.
    recognition.maxAlternatives = 1;

    let sessionFinal = "";

    recognition.onstart = () => {
      sessionFinal = "";
      setInterim("");
    };

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          sessionFinal += t + " ";
        } else {
          interimText = t; // Only show the current in-progress word(s)
        }
      }
      setInterim(interimText);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech") {
        setListening(false);
        setInterim("");
      }
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      // Emit the clean final string once per session
      const clean = sessionFinal.trim();
      if (clean) setLastFinal(clean);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback((lang = "hi-IN") => {
    if (!recognitionRef.current) return;
    try {
      // Set the chosen language right before each session starts
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // Already started — ignore
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  return { listening, supported, interim, lastFinal, startListening, stopListening };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportIssue() {
  const { user } = useAuth();
  const { complaints, submitComplaint, support } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const cameraInputRef = useRef(null);
  const region = getRegion(user?.regionPreference);
  const isPolygonRegion = region.geoMode === "polygon";
  const areaTypeLabel = getAreaLabel(region.regionId);
  const regionZones = getZonesForRegion(region.regionId);

  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [imageMeta, setImageMeta] = useState(null);
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [zoneState, setZoneState] = useState(null);
  const [manualZoneId, setManualZoneId] = useState("");
  const [geoIntel, setGeoIntel] = useState(null);
  const [ai, setAi] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  // Language toggle for voice input: "hi-IN" = Hindi, "en-IN" = English
  const [voiceLang, setVoiceLang] = useState("hi-IN");

  // Voice input — append each clean session result to description
  const { listening, supported: speechSupported, interim, lastFinal, startListening, stopListening } =
    useSpeechInput();

  // Whenever a new final transcript arrives, append it to the description
  const lastFinalRef = useRef(null);
  useEffect(() => {
    if (lastFinal && lastFinal !== lastFinalRef.current) {
      lastFinalRef.current = lastFinal;
      setDescription((prev) => (prev ? prev.trimEnd() + " " + lastFinal : lastFinal));
    }
  }, [lastFinal]);

  const selectedZone = useMemo(
    () => zoneState?.zone || regionZones.find((zone) => zone.zoneId === manualZoneId) || null,
    [manualZoneId, regionZones, zoneState],
  );
  const areaLabel = isPolygonRegion ? geoIntel?.ward?.name : selectedZone?.name;
  const canSubmitLocation = isPolygonRegion ? Boolean(location) : Boolean(selectedZone);

  function applyLocationIntelligence(intel) {
    if (intel.geoMode === "circle") {
      setZoneState(intel.zoneDetection);
      setManualZoneId(intel.zoneDetection?.zone?.zoneId || "");
      setGeoIntel(null);
      showToast(
        intel.zoneDetection?.zone
          ? `Detected ${intel.zoneDetection.zone.name}.`
          : "Location captured; choose a zone manually.",
      );
    } else {
      setGeoIntel(intel);
      showToast(
        intel.ward
          ? `Detected ${areaTypeLabel} ${intel.ward.number} - ${intel.ward.name}.`
          : `Location captured, but outside mapped ${region.name} ${areaTypeLabel.toLowerCase()}s.`,
      );
    }
  }

  async function resolveGps(gps) {
    setLocation(gps);
    try {
      const intel = await resolveLocationIntelligence(gps, region);
      applyLocationIntelligence(intel);
    } catch {
      // Non-fatal
    }
  }

  async function handleImage(file) {
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setImage(compressed.imageData);
      setImageMeta(compressed);
      showToast("Photo captured. Checking for embedded location…");
      const gpsFromExif = await extractExifGps(file);
      if (gpsFromExif) {
        await resolveGps({ ...gpsFromExif });
        showToast("📍 Location auto-detected from photo metadata.");
      } else {
        showToast("No GPS in photo. Use 'Capture GPS' or pick on map.");
      }
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function captureLocation() {
    setLocating(true);
    try {
      const gps = await getBrowserLocation();
      await resolveGps(gps);
    } catch (error) {
      showToast(
        (error.message || "Location permission denied.") + " — You can also pick on the map.",
        "error",
      );
      setZoneState({ zone: null, status: "manual" });
    } finally {
      setLocating(false);
    }
  }

  async function handleMapPickConfirm(coords) {
    setShowMapPicker(false);
    showToast("Resolving map location…");
    await resolveGps({ ...coords, accuracy: null, fromMap: true });
  }

  async function analyze() {
    if (description.trim().length < 12) {
      showToast("Add a short description before AI triage.", "error");
      return null;
    }
    setBusy(true);
    try {
      const result = await classifyComplaint({
        description,
        imageData: image,
        zoneName: areaLabel,
        regionName: region.name,
        regionId: region.regionId,
      });
      setAi(result);
      const candidate = {
        regionId: region.regionId,
        zoneId: selectedZone?.zoneId,
        ward: geoIntel?.ward || null,
        latitude: location?.latitude || selectedZone?.latitude,
        longitude: location?.longitude || selectedZone?.longitude,
        description,
        aiCategory: result.category,
        imageHash: imageMeta?.imageHash || "",
        createdAt: new Date().toISOString(),
      };
      setDuplicate(findLikelyDuplicate(candidate, complaints));
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!image) {
      showToast("Take a photo first to save a draft.", "error");
      return;
    }
    setSavingDraft(true);
    try {
      saveDraft({
        userId: user.uid,
        regionId: region.regionId,
        imageData: image,
        imageMimeType: imageMeta?.imageMimeType || "image/jpeg",
        imageSize: imageMeta?.imageSize || 0,
        imageHash: imageMeta?.imageHash || "",
        description: description.trim(),
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        accuracy: location?.accuracy || null,
        locationFromExif: location?.fromExif || false,
        ward: geoIntel?.ward || null,
        zone: geoIntel?.zone || null,
        zoneId: selectedZone?.zoneId || "",
        zoneName: isPolygonRegion
          ? geoIntel?.zone?.number
            ? `Zone ${geoIntel.zone.number}`
            : ""
          : selectedZone?.name || "",
        locality: geoIntel?.address?.locality || "",
        road: geoIntel?.address?.road || "",
        formattedAddress: geoIntel?.address?.formattedAddress || "",
        city: isPolygonRegion ? region.name : "",
        state: region.state,
        country: region.country,
        municipality: region.municipality || "",
      });
      showToast("Draft saved! Complete it later from My Complaints.");
      navigate("/my-complaints");
    } catch (error) {
      showToast(error.message || "Could not save draft.", "error");
    } finally {
      setSavingDraft(false);
    }
  }

  async function createNewComplaint(event) {
    event.preventDefault();
    if (!image) {
      showToast("Take a live photo so the authority has evidence.", "error");
      return;
    }
    if (!canSubmitLocation) {
      showToast("Capture location, pick on map, or choose a zone.", "error");
      return;
    }
    const classification = ai || (await analyze());
    if (!classification) return;
    if (duplicate) {
      showToast("A likely duplicate exists. Support it or confirm you need a separate report.", "error");
      return;
    }
    setBusy(true);
    try {
      const complaint = await submitComplaint({
        userId: user.uid,
        regionId: region.regionId,
        city: isPolygonRegion ? region.name : "",
        state: region.state,
        country: region.country,
        municipality: region.municipality || "",
        ward: geoIntel?.ward || null,
        zone: geoIntel?.zone || null,
        locality: geoIntel?.address?.locality || "",
        road: geoIntel?.address?.road || "",
        formattedAddress: geoIntel?.address?.formattedAddress || "",
        zoneId: selectedZone?.zoneId || "",
        zoneName: isPolygonRegion
          ? geoIntel?.zone?.number
            ? `Zone ${geoIntel.zone.number}`
            : ""
          : selectedZone?.name,
        latitude: location?.latitude || selectedZone?.latitude,
        longitude: location?.longitude || selectedZone?.longitude,
        accuracy: location?.accuracy || null,
        imageData: image,
        imageMimeType: imageMeta?.imageMimeType || "image/jpeg",
        imageSize: imageMeta?.imageSize || 0,
        imageHash: imageMeta?.imageHash || "",
        description: description.trim(),
        aiCategory: classification.category,
        aiSubcategory: classification.subcategory,
        aiPriority: classification.priority,
        aiSummary: classification.summary,
        aiSeverityScore: classification.severityScore,
        aiCivicImpactScore: classification.civicImpactScore,
        aiRisks: classification.risks,
        aiRecommendedAction: classification.recommendedAction,
        aiSuggestedDepartment: classification.aiSuggestedDepartment,
        confidence: classification.confidence,
        tags: classification.tags,
        assignedDepartment: classification.aiSuggestedDepartment,
        duplicateGroupId: "",
        duplicatePercentage: 0,
        isDuplicate: false,
        anonymous: false,
      });
      showToast("Complaint submitted.");
      navigate(`/complaints/${complaint.complaintId}`);
    } catch (error) {
      if (error.code === "permission-denied") {
        showToast("Please log in to submit a complaint.", "error");
        navigate("/signin", { state: { from: routerLocation } });
      } else {
        showToast(error.message || "Could not submit complaint.", "error");
      }
    } finally {
      setBusy(false);
    }
  }

  async function supportDuplicate() {
    if (!duplicate) return;
    try {
      const result = await support(duplicate.complaint.complaintId, user.uid);
      showToast(
        result.alreadySupported
          ? "You already support this issue."
          : "Support added to existing complaint.",
      );
      navigate(`/complaints/${duplicate.complaint.complaintId}`);
    } catch (error) {
      if (error.code === "permission-denied") {
        showToast("Please log in to support this issue.", "error");
        navigate("/signin", { state: { from: routerLocation } });
      } else {
        showToast(error.message || "Could not support this issue.", "error");
      }
    }
  }

  return (
    <>
      {/* Map picker modal */}
      {showMapPicker && (
        <LocationPickerModal
          initialCenter={location || { latitude: region.defaultCenterLat, longitude: region.defaultCenterLng }}
          onConfirm={handleMapPickConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <section className="section">
        <div className="mb-6">
          <p className="eyebrow">Report in under one minute</p>
          <h1 className="page-title">Report a civic issue</h1>
        </div>

        <form className="grid gap-6 lg:grid-cols-[1fr_0.78fr]" onSubmit={createNewComplaint}>
          <div className="card space-y-5 p-5">

            {/* ── Photo capture (live camera only) ── */}
            <div>
              <span className="mb-2 block text-sm font-bold">Issue photo</span>
              <div className="grid min-h-64 place-items-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition hover:border-civic/40 hover:bg-teal-50/40">
                {image ? (
                  <img
                    src={image}
                    alt="Captured complaint evidence"
                    className="max-h-80 rounded-lg object-contain shadow-card"
                  />
                ) : (
                  <div className="text-center text-slate-500">
                    <span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-civic ring-4 ring-teal-100">
                      <Camera size={20} />
                    </span>
                    <p className="text-sm">
                      Click a <strong>live photo</strong> of the issue.
                      <br />
                      <span className="text-xs text-slate-400">
                        Live photos ensure authenticity. Gallery upload is disabled.
                      </span>
                    </p>
                  </div>
                )}
                <div className="mt-4 w-full">
                  <button
                    type="button"
                    className="btn-primary w-full"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    <Camera size={17} />
                    {image ? "Retake photo" : "Take live photo"}
                  </button>
                </div>
                <input
                  ref={cameraInputRef}
                  className="hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => handleImage(event.target.files?.[0])}
                />
              </div>
            </div>

            {/* ── Voice / text description ── */}
            <div>
              <span className="mb-2 block text-sm font-bold">
                Describe the issue
                <span className="ml-2 text-xs font-normal text-slate-500">
                  — toggle 🇮🇳 / 🇬🇧 to choose language before recording
                </span>
              </span>

              {speechSupported ? (
                <div className="mb-3">
                  {/* Language toggle + Mic button row */}
                  <div className="flex gap-2">
                    {/* Language toggle pill */}
                    <button
                      type="button"
                      disabled={listening}
                      onClick={() => setVoiceLang((l) => (l === "hi-IN" ? "en-IN" : "hi-IN"))}
                      title={voiceLang === "hi-IN" ? "Switch to English" : "Switch to Hindi"}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2.5 text-sm font-bold transition duration-150 ${
                        listening
                          ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                          : "border-slate-200 bg-white text-ink shadow-sm hover:border-civic/60 hover:text-civic hover:shadow-card"
                      }`}
                    >
                      <span className="text-base leading-none">
                        {voiceLang === "hi-IN" ? "🇮🇳" : "🇬🇧"}
                      </span>
                      <span>{voiceLang === "hi-IN" ? "हिं" : "EN"}</span>
                    </button>

                    {/* Mic / Stop button */}
                    <button
                      type="button"
                      onClick={listening ? stopListening : () => startListening(voiceLang)}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition duration-150 ${
                        listening
                          ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                          : "border-slate-200 bg-white text-ink shadow-sm hover:border-civic/60 hover:text-civic hover:shadow-card"
                      }`}
                    >
                      {listening ? (
                        <>
                          <MicOff size={17} className="animate-pulse" />
                          Stop recording
                        </>
                      ) : (
                        <>
                          <Mic size={17} />
                          {description ? "Add more by voice" : "Start voice description"}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Live interim preview while speaking */}
                  {listening && (
                    <div className="mt-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">
                      {interim ? (
                        <span className="italic">{interim}<span className="animate-pulse">…</span></span>
                      ) : (
                        <span className="text-teal-600">
                          🎙️ Listening in {voiceLang === "hi-IN" ? "Hindi (हिन्दी)" : "English"}…
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Voice input is not supported in this browser. Please use Chrome or Safari.
                </p>
              )}

              <textarea
                className="field min-h-28"
                required
                maxLength={420}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Example: Streetlight near hostel walkway has been off for three nights."
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-xs text-slate-500">{description.length}/420 characters</span>
                {description.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-red-500 transition"
                    onClick={() => setDescription("")}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* ── Location controls ── */}
            <div>
              <span className="mb-2 block text-sm font-bold">Location</span>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={captureLocation}
                  disabled={locating}
                >
                  <LocateFixed size={17} />
                  {locating ? "Locating…" : location ? "Re-capture GPS" : "Capture GPS"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowMapPicker(true)}
                >
                  <MapPinned size={17} />
                  Pick on map
                </button>
              </div>

              {location && (
                <p className="mt-2 rounded-md bg-teal-50 px-3 py-1.5 text-xs text-teal-800">
                  📍{" "}
                  {location.fromExif
                    ? "From photo metadata"
                    : location.fromMap
                      ? "Picked on map"
                      : `GPS (±${Math.round(location.accuracy || 0)}m)`}{" "}
                  — {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" className="btn-secondary" onClick={analyze} disabled={busy}>
                <Sparkles size={17} />
                Run AI triage
              </button>
              <div /> {/* spacer */}
            </div>

            {!isPolygonRegion && (
              <label className="block">
                <span className="mb-2 block text-sm font-bold">Detected or manual zone</span>
                <select
                  className="field"
                  value={manualZoneId}
                  onChange={(event) => setManualZoneId(event.target.value)}
                >
                  <option value="">Unmapped / Verify manually</option>
                  {regionZones.map((zone) => (
                    <option key={zone.zoneId} value={zone.zoneId}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* ── Save as Draft ── */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">🚦 In a hurry? Save as draft</p>
              <p className="mt-1 text-xs text-slate-500">
                Take a photo and save — add description and submit later from{" "}
                <strong>My Complaints</strong>.
              </p>
              <button
                type="button"
                className="btn-secondary mt-3 w-full"
                onClick={handleSaveDraft}
                disabled={!image || savingDraft}
              >
                {savingDraft ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
                {savingDraft ? "Saving…" : "Save as incomplete draft"}
              </button>
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="flex items-center gap-2 text-lg font-black">
                <MapPin size={18} className="text-civic" /> Submission intelligence
              </h2>
              <div className="mt-4 space-y-2 text-sm">
                <p>
                  {isPolygonRegion ? "City" : "Region"}: <strong>{region.name}</strong>
                </p>
                <p>
                  GPS:{" "}
                  {location
                    ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${location.fromExif ? " (EXIF)" : location.fromMap ? " (map)" : ` (±${Math.round(location.accuracy || 0)}m)`}`
                    : "Not captured"}
                </p>
                {isPolygonRegion ? (
                  <>
                    <p>
                      {areaTypeLabel}:{" "}
                      <strong>
                        {geoIntel?.ward
                          ? `${geoIntel.ward.number} - ${geoIntel.ward.name}`
                          : location
                            ? `Outside mapped ${areaTypeLabel.toLowerCase()}s`
                            : "Not captured"}
                      </strong>
                    </p>
                    <p>
                      Zone:{" "}
                      <strong>{geoIntel?.zone ? `Zone ${geoIntel.zone.number}` : "-"}</strong>
                    </p>
                    <p>Locality: {geoIntel?.address?.locality || "-"}</p>
                    <p>Address: {geoIntel?.address?.formattedAddress || "-"}</p>
                    {location && !geoIntel?.ward && (
                      <p className="rounded-md bg-amber-50 p-3 text-amber-900">
                        This location is outside the mapped {region.name}{" "}
                        {areaTypeLabel.toLowerCase()} boundaries. It can still be submitted, but no{" "}
                        {areaTypeLabel.toLowerCase()} will be attached.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      Zone: <strong>{selectedZone?.name || "Unmapped / Verify"}</strong>
                    </p>
                    {zoneState?.status === "outside" && (
                      <p className="rounded-md bg-amber-50 p-3 text-amber-900">
                        Nearest configured zone is {zoneState.nearestZone?.name}, but GPS is
                        outside its radius.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {ai && (
              <div className="card animate-fade-up p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-lg font-black">
                    <Sparkles size={18} className="text-civic" /> AI classification
                  </h2>
                  <PriorityBadge priority={ai.priority} />
                </div>
                <p className="mt-3 text-sm font-bold">
                  {ai.category}
                  {ai.subcategory ? ` - ${ai.subcategory}` : ""}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{ai.summary}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <span className="rounded-md bg-slate-50 px-2 py-1.5">
                    Severity: <strong className="text-ink">{ai.severityScore}/10</strong>
                  </span>
                  <span className="rounded-md bg-slate-50 px-2 py-1.5">
                    Civic impact: <strong className="text-ink">{ai.civicImpactScore}/100</strong>
                  </span>
                  <span className="rounded-md bg-slate-50 px-2 py-1.5">
                    Department: <strong className="text-ink">{ai.aiSuggestedDepartment}</strong>
                  </span>
                  <span className="rounded-md bg-slate-50 px-2 py-1.5">
                    Confidence:{" "}
                    <strong className="text-ink">{Math.round(ai.confidence * 100)}%</strong>
                  </span>
                </div>
                {ai.risks && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {Object.entries(ai.risks)
                      .filter(([, level]) => level !== "Low")
                      .map(([key, level]) => (
                        <span
                          key={key}
                          className="rounded-full bg-red-50 px-2 py-1 font-bold text-red-800"
                        >
                          {key}: {level}
                        </span>
                      ))}
                  </div>
                )}
                {ai.recommendedAction && (
                  <p className="mt-3 text-xs text-slate-500">
                    Suggested action: {ai.recommendedAction}
                  </p>
                )}
                <p className="mt-3 text-xs font-semibold text-slate-500">Source: {ai.source}</p>
                {ai.confidence < 0.65 && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-sm font-bold">Adjust category</span>
                    <select
                      className="field"
                      value={ai.category}
                      onChange={(event) => setAi({ ...ai, category: event.target.value })}
                    >
                      {issueCategories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {duplicate && (
              <div className="card animate-fade-up border-amber-200 bg-amber-50 p-5">
                <h2 className="flex items-center gap-2 text-lg font-black text-amber-950">
                  <AlertTriangle size={19} /> Likely duplicate ({duplicate.duplicatePercentage}%
                  match)
                </h2>
                <p className="mt-2 text-sm leading-6 text-amber-900">
                  A similar issue already exists. Supporting it will raise priority without
                  cluttering the system.
                </p>
                <Link
                  to={`/complaints/${duplicate.complaint.complaintId}`}
                  className="mt-3 block rounded-md bg-white p-3 text-sm font-bold"
                >
                  {duplicate.complaint.aiSummary}
                </Link>
                <button
                  type="button"
                  className="btn-primary mt-3 w-full"
                  onClick={supportDuplicate}
                >
                  <ThumbsUp size={17} />
                  Support existing complaint
                </button>
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              <CheckCircle2 size={18} />
              {busy ? "Processing..." : "Submit new complaint"}
            </button>
          </aside>
        </form>
      </section>
    </>
  );
}

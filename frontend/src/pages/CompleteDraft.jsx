import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LocateFixed,
  MapPin,
  MapPinned,
  Mic,
  MicOff,
  Sparkles,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getAreaLabel, getRegion, getZonesForRegion, issueCategories } from "../config/regions.js";
import { classifyComplaint } from "../services/aiService.js";
import { findLikelyDuplicate } from "../services/duplicateService.js";
import { deleteDraft, listDrafts } from "../services/complaintRepository.js";
import { getBrowserLocation } from "../utils/geo.js";
import { resolveLocationIntelligence } from "../services/geoService.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { PriorityBadge } from "../components/ui/Badge.jsx";
import LocationPickerModal from "../components/map/LocationPickerModal.jsx";

// ─── Voice input hook (non-continuous — one clean session per press) ─────────

function useSpeechInput() {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [interim, setInterim] = useState("");
  const [lastFinal, setLastFinal] = useState(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "hi-IN";
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
          interimText = t;
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
      const clean = sessionFinal.trim();
      if (clean) setLastFinal(clean);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // Already started
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
  }, []);

  return { listening, supported, interim, lastFinal, startListening, stopListening };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompleteDraft() {
  const { draftId } = useParams();
  const { user } = useAuth();
  const { complaints, submitComplaint, support } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [draft, setDraft] = useState(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [zoneState, setZoneState] = useState(null);
  const [manualZoneId, setManualZoneId] = useState("");
  const [geoIntel, setGeoIntel] = useState(null);
  const [ai, setAi] = useState(null);
  const [duplicate, setDuplicate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const region = useMemo(
    () => getRegion(draft?.regionId || user?.regionPreference),
    [draft?.regionId, user?.regionPreference],
  );
  const isPolygonRegion = region.geoMode === "polygon";
  const areaTypeLabel = getAreaLabel(region.regionId);
  const regionZones = getZonesForRegion(region.regionId);

  // Load draft from localStorage
  useEffect(() => {
    if (!user?.uid) return;
    const drafts = listDrafts(user.uid);
    const found = drafts.find((d) => d.draftId === draftId);
    if (!found) {
      showToast("Draft not found or already submitted.", "error");
      navigate("/my-complaints");
      return;
    }
    setDraft(found);
    setDescription(found.description || "");

    // Restore saved location if present
    if (found.latitude && found.longitude) {
      setLocation({
        latitude: found.latitude,
        longitude: found.longitude,
        accuracy: found.accuracy || null,
        fromExif: found.locationFromExif || false,
      });
      if (found.zoneId) setManualZoneId(found.zoneId);
      if (found.ward || found.zone || found.locality) {
        setGeoIntel({
          ward: found.ward || null,
          zone: found.zone || null,
          address: {
            locality: found.locality || "",
            road: found.road || "",
            formattedAddress: found.formattedAddress || "",
          },
        });
      }
    }
  }, [draftId, navigate, showToast, user?.uid]);

  // Voice input — append each clean session to description
  const { listening, supported: speechSupported, interim, lastFinal, startListening, stopListening } =
    useSpeechInput();

  const lastFinalRef = useRef(null);
  useEffect(() => {
    if (lastFinal && lastFinal !== lastFinalRef.current) {
      lastFinalRef.current = lastFinal;
      setDescription((prev) => (prev ? prev.trimEnd() + " " + lastFinal : lastFinal));
    }
  }, [lastFinal]);

  const selectedZone = useMemo(
    () => zoneState?.zone || regionZones.find((z) => z.zoneId === manualZoneId) || null,
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

  async function captureLocation() {
    setLocating(true);
    try {
      const gps = await getBrowserLocation();
      setLocation(gps);
      const intel = await resolveLocationIntelligence(gps, region);
      applyLocationIntelligence(intel);
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
    try {
      const loc = { ...coords, accuracy: null, fromMap: true };
      setLocation(loc);
      const intel = await resolveLocationIntelligence(loc, region);
      applyLocationIntelligence(intel);
    } catch {
      // Non-fatal — location coords still set
    }
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
        imageData: draft?.imageData,
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
        imageHash: draft?.imageHash || "",
        createdAt: new Date().toISOString(),
      };
      setDuplicate(findLikelyDuplicate(candidate, complaints));
      return result;
    } finally {
      setBusy(false);
    }
  }

  async function handleDiscard() {
    if (!window.confirm("Delete this draft? This cannot be undone.")) return;
    deleteDraft(draftId);
    showToast("Draft discarded.");
    navigate("/my-complaints");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!description.trim()) {
      showToast("Please describe the issue before submitting.", "error");
      return;
    }
    if (!canSubmitLocation) {
      showToast("Capture location or choose a zone.", "error");
      return;
    }
    const classification = ai || (await analyze());
    if (!classification) return;
    if (duplicate) {
      showToast(
        "A likely duplicate exists. Support it or confirm you need a separate report.",
        "error",
      );
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
          : selectedZone?.name || "",
        latitude: location?.latitude || selectedZone?.latitude,
        longitude: location?.longitude || selectedZone?.longitude,
        accuracy: location?.accuracy || null,
        imageData: draft?.imageData,
        imageMimeType: draft?.imageMimeType || "image/jpeg",
        imageSize: draft?.imageSize || 0,
        imageHash: draft?.imageHash || "",
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

      // Remove draft once submitted
      deleteDraft(draftId);
      showToast("Complaint submitted successfully!");
      navigate(`/complaints/${complaint.complaintId}`);
    } catch (error) {
      showToast(error.message || "Could not submit complaint.", "error");
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
      showToast(error.message || "Could not support this issue.", "error");
    }
  }

  if (!draft) {
    return (
      <section className="section grid place-items-center py-20">
        <Loader2 size={32} className="animate-spin text-civic" />
      </section>
    );
  }

  return (
    <>
      {showMapPicker && (
        <LocationPickerModal
          initialCenter={location || { latitude: region.defaultCenterLat, longitude: region.defaultCenterLng }}
          onConfirm={handleMapPickConfirm}
          onClose={() => setShowMapPicker(false)}
        />
      )}

      <section className="section">
        <div className="mb-6">
          <Link
            to="/my-complaints"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-civic transition"
          >
            <ArrowLeft size={16} /> Back to My Complaints
          </Link>
          <p className="eyebrow">Incomplete complaint</p>
          <h1 className="page-title">Complete your draft</h1>
          <p className="mt-2 text-sm text-slate-500">
            Saved {new Date(draft.createdAt).toLocaleString("en-IN")} · Add a description and
            location to submit.
          </p>
        </div>

      <form className="grid gap-6 lg:grid-cols-[1fr_0.78fr]" onSubmit={handleSubmit}>
        <div className="card space-y-5 p-5">

          {/* Draft photo (read-only preview) */}
          <div>
            <span className="mb-2 block text-sm font-bold">Captured photo</span>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              <img
                src={draft.imageData}
                alt="Draft complaint photo"
                className="max-h-72 w-full object-contain"
              />
            </div>
          </div>

          {/* Voice / text description */}
          <div>
            <span className="mb-2 block text-sm font-bold">
              Describe the issue
              <span className="ml-2 text-xs font-normal text-slate-500">
                — speak in Hindi or English
              </span>
            </span>

            {speechSupported ? (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold transition duration-150 ${
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
                      {description ? "Continue speaking" : "Start voice description"}
                    </>
                  )}
                </button>
                {listening && interim && (
                  <div className="mt-2 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800 italic">
                    <span className="mr-1 font-semibold not-italic text-teal-600">Hearing:</span>
                    {interim}
                    <span className="ml-1 animate-pulse">…</span>
                  </div>
                )}
                {listening && (
                  <p className="mt-1 text-center text-xs text-slate-500">
                    🎙️ Listening… speak clearly in Hindi or English
                  </p>
                )}
              </div>
            ) : (
              <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Voice input is not supported in this browser. Please type below.
              </p>
            )}

            <textarea
              className="field min-h-28"
              required
              maxLength={420}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the issue you photographed…"
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

          {/* Location */}
          <div>
            <span className="mb-2 block text-sm font-bold">Location</span>
            {location ? (
              <p className="mb-2 rounded-md bg-teal-50 px-3 py-2 text-xs text-teal-800">
                📍{" "}
                {location.fromExif
                  ? "From photo metadata"
                  : location.fromMap
                    ? "Picked on map"
                    : `GPS (±${Math.round(location.accuracy || 0)}m)`}{" "}
                — {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}. Tap below to
                override.
              </p>
            ) : (
              <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No location saved. Capture GPS or pick on the map below.
              </p>
            )}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="btn-secondary" onClick={analyze} disabled={busy}>
              <Sparkles size={17} />
              Run AI triage
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              onClick={handleDiscard}
            >
              <Trash2 size={17} />
              Discard draft
            </button>
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <MapPin size={18} className="text-civic" /> Location details
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>
                {isPolygonRegion ? "City" : "Region"}: <strong>{region.name}</strong>
              </p>
              <p>
                GPS:{" "}
                {location
                  ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}${location.fromExif ? " (from photo EXIF)" : ""}`
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
                  <p>Zone: <strong>{geoIntel?.zone ? `Zone ${geoIntel.zone.number}` : "-"}</strong></p>
                  <p>Locality: {geoIntel?.address?.locality || "-"}</p>
                </>
              ) : (
                <p>Zone: <strong>{selectedZone?.name || "Unmapped / Verify"}</strong></p>
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
                  Confidence: <strong className="text-ink">{Math.round(ai.confidence * 100)}%</strong>
                </span>
              </div>
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
                <AlertTriangle size={19} /> Likely duplicate ({duplicate.duplicatePercentage}% match)
              </h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">
                A similar issue already exists. Supporting it will raise priority.
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
            {busy ? "Processing..." : "Submit complaint"}
          </button>
        </aside>
      </form>
    </section>
    </>
  );
}

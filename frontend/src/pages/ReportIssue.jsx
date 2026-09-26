import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, LocateFixed, MapPin, Sparkles, ThumbsUp } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAreaLabel, getRegion, getZonesForRegion, issueCategories } from "../config/regions.js";
import { classifyComplaint } from "../services/aiService.js";
import { findLikelyDuplicate } from "../services/duplicateService.js";
import { compressImageToBase64 } from "../utils/image.js";
import { getBrowserLocation } from "../utils/geo.js";
import { resolveLocationIntelligence } from "../services/geoService.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { PriorityBadge } from "../components/ui/Badge.jsx";

export default function ReportIssue() {
  const { user } = useAuth();
  const { complaints, submitComplaint, support } = useData();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
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

  const selectedZone = useMemo(
    () => zoneState?.zone || regionZones.find((zone) => zone.zoneId === manualZoneId) || null,
    [manualZoneId, regionZones, zoneState],
  );
  const areaLabel = isPolygonRegion ? geoIntel?.ward?.name : selectedZone?.name;
  const canSubmitLocation = isPolygonRegion ? Boolean(location) : Boolean(selectedZone);

  async function handleImage(file) {
    try {
      const compressed = await compressImageToBase64(file);
      setImage(compressed.imageData);
      setImageMeta(compressed);
      showToast("Photo compressed for prototype Firestore storage.");
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  async function captureLocation() {
    setLocating(true);
    try {
      const gps = await getBrowserLocation();
      setLocation(gps);
      const intel = await resolveLocationIntelligence(gps, region);
      if (intel.geoMode === "circle") {
        setZoneState(intel.zoneDetection);
        setManualZoneId(intel.zoneDetection?.zone?.zoneId || "");
        setGeoIntel(null);
        showToast(intel.zoneDetection?.zone ? `Detected ${intel.zoneDetection.zone.name}.` : "Location captured; choose a zone manually.");
      } else {
        setGeoIntel(intel);
        showToast(intel.ward ? `Detected ${areaTypeLabel} ${intel.ward.number} - ${intel.ward.name}.` : `Location captured, but it falls outside mapped ${region.name} ${areaTypeLabel.toLowerCase()}s.`);
      }
    } catch (error) {
      showToast(error.message || "Location permission denied.", "error");
      setZoneState({ zone: null, status: "manual" });
    } finally {
      setLocating(false);
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

  async function createNewComplaint(event) {
    event.preventDefault();
    if (!image) {
      showToast("Upload a photo so the authority has evidence.", "error");
      return;
    }
    if (!canSubmitLocation) {
      showToast("Capture location or choose a zone.", "error");
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
        zoneName: isPolygonRegion ? (geoIntel?.zone?.number ? `Zone ${geoIntel.zone.number}` : "") : selectedZone?.name,
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
      showToast(result.alreadySupported ? "You already support this issue." : "Support added to existing complaint.");
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
    <section className="section">
      <div className="mb-6">
        <p className="eyebrow">Report in under one minute</p>
        <h1 className="page-title">Report a civic issue</h1>
      </div>

      <form className="grid gap-6 lg:grid-cols-[1fr_0.78fr]" onSubmit={createNewComplaint}>
        <div className="card space-y-5 p-5">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">Issue photo</span>
            <div className="grid min-h-64 place-items-center rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4 transition hover:border-civic/40 hover:bg-teal-50/40">
              {image ? (
                <img src={image} alt="Selected complaint evidence" className="max-h-80 rounded-lg object-contain shadow-card" />
              ) : (
                <div className="text-center text-slate-500">
                  <span className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-teal-50 text-civic ring-4 ring-teal-100">
                    <Camera size={20} />
                  </span>
                  Take a live photo or upload one from storage. It will be compressed before saving.
                </div>
              )}
              <div className="mt-4 grid w-full gap-2 sm:grid-cols-2">
                <button type="button" className="btn-secondary" onClick={() => cameraInputRef.current?.click()}>
                  <Camera size={17} />
                  Take photo
                </button>
                <button type="button" className="btn-secondary" onClick={() => galleryInputRef.current?.click()}>
                  <ImagePlus size={17} />
                  Choose from gallery
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
              <input
                ref={galleryInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                onChange={(event) => handleImage(event.target.files?.[0])}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold">Short description</span>
            <textarea
              className="field min-h-32"
              required
              maxLength={420}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Example: Streetlight near hostel walkway has been off for three nights."
            />
            <span className="mt-1 block text-xs text-slate-500">{description.length}/420 characters</span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="btn-secondary" onClick={captureLocation} disabled={locating}>
              <LocateFixed size={17} />
              {locating ? "Locating..." : "Capture GPS location"}
            </button>
            <button type="button" className="btn-secondary" onClick={analyze} disabled={busy}>
              <Sparkles size={17} />
              Run AI triage
            </button>
          </div>

          {!isPolygonRegion && (
            <label className="block">
              <span className="mb-2 block text-sm font-bold">Detected or manual zone</span>
              <select className="field" value={manualZoneId} onChange={(event) => setManualZoneId(event.target.value)}>
                <option value="">Unmapped / Verify manually</option>
                {regionZones.map((zone) => <option key={zone.zoneId} value={zone.zoneId}>{zone.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="flex items-center gap-2 text-lg font-black"><MapPin size={18} className="text-civic" /> Submission intelligence</h2>
            <div className="mt-4 space-y-2 text-sm">
              <p>{isPolygonRegion ? "City" : "Region"}: <strong>{region.name}</strong></p>
              <p>GPS: {location ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} (${Math.round(location.accuracy || 0)}m)` : "Not captured"}</p>
              {isPolygonRegion ? (
                <>
                  <p>{areaTypeLabel}: <strong>{geoIntel?.ward ? `${geoIntel.ward.number} - ${geoIntel.ward.name}` : location ? `Outside mapped ${areaTypeLabel.toLowerCase()}s` : "Not captured"}</strong></p>
                  <p>Zone: <strong>{geoIntel?.zone ? `Zone ${geoIntel.zone.number}` : "-"}</strong></p>
                  <p>Locality: {geoIntel?.address?.locality || "-"}</p>
                  <p>Address: {geoIntel?.address?.formattedAddress || "-"}</p>
                  {location && !geoIntel?.ward && (
                    <p className="rounded-md bg-amber-50 p-3 text-amber-900">This location is outside the mapped {region.name} {areaTypeLabel.toLowerCase()} boundaries. It can still be submitted, but no {areaTypeLabel.toLowerCase()} will be attached.</p>
                  )}
                </>
              ) : (
                <>
                  <p>Zone: <strong>{selectedZone?.name || "Unmapped / Verify"}</strong></p>
                  {zoneState?.status === "outside" && (
                    <p className="rounded-md bg-amber-50 p-3 text-amber-900">Nearest configured zone is {zoneState.nearestZone?.name}, but GPS is outside its radius.</p>
                  )}
                </>
              )}
            </div>
          </div>

          {ai && (
            <div className="card animate-fade-up p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-lg font-black"><Sparkles size={18} className="text-civic" /> AI classification</h2>
                <PriorityBadge priority={ai.priority} />
              </div>
              <p className="mt-3 text-sm font-bold">{ai.category}{ai.subcategory ? ` - ${ai.subcategory}` : ""}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{ai.summary}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <span className="rounded-md bg-slate-50 px-2 py-1.5">Severity: <strong className="text-ink">{ai.severityScore}/10</strong></span>
                <span className="rounded-md bg-slate-50 px-2 py-1.5">Civic impact: <strong className="text-ink">{ai.civicImpactScore}/100</strong></span>
                <span className="rounded-md bg-slate-50 px-2 py-1.5">Department: <strong className="text-ink">{ai.aiSuggestedDepartment}</strong></span>
                <span className="rounded-md bg-slate-50 px-2 py-1.5">Confidence: <strong className="text-ink">{Math.round(ai.confidence * 100)}%</strong></span>
              </div>
              {ai.risks && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {Object.entries(ai.risks).filter(([, level]) => level !== "Low").map(([key, level]) => (
                    <span key={key} className="rounded-full bg-red-50 px-2 py-1 font-bold text-red-800">{key}: {level}</span>
                  ))}
                </div>
              )}
              {ai.recommendedAction && <p className="mt-3 text-xs text-slate-500">Suggested action: {ai.recommendedAction}</p>}
              <p className="mt-3 text-xs font-semibold text-slate-500">Source: {ai.source}</p>
              {ai.confidence < 0.65 && (
                <label className="mt-3 block">
                  <span className="mb-1 block text-sm font-bold">Adjust category</span>
                  <select className="field" value={ai.category} onChange={(event) => setAi({ ...ai, category: event.target.value })}>
                    {issueCategories.map((category) => <option key={category}>{category}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}

          {duplicate && (
            <div className="card animate-fade-up border-amber-200 bg-amber-50 p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-amber-950"><AlertTriangle size={19} /> Likely duplicate ({duplicate.duplicatePercentage}% match)</h2>
              <p className="mt-2 text-sm leading-6 text-amber-900">A similar issue already exists. Supporting it will raise priority without cluttering the system.</p>
              <Link to={`/complaints/${duplicate.complaint.complaintId}`} className="mt-3 block rounded-md bg-white p-3 text-sm font-bold">
                {duplicate.complaint.aiSummary}
              </Link>
              <button type="button" className="btn-primary mt-3 w-full" onClick={supportDuplicate}>
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
  );
}

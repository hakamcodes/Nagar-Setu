import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, X, Check } from "lucide-react";

/**
 * LocationPickerModal — a full-screen Leaflet map modal.
 * User clicks / drags the marker to choose a location.
 * On confirm, calls onConfirm({ latitude, longitude }).
 */
export default function LocationPickerModal({ onConfirm, onClose, initialCenter }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const center = initialCenter
      ? [initialCenter.latitude, initialCenter.longitude]
      : [23.2599, 77.4126]; // Default: Bhopal

    const map = L.map(mapNodeRef.current, { scrollWheelZoom: true }).setView(center, 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Draggable marker — starts at center
    const marker = L.marker(center, {
      draggable: true,
      icon: L.divIcon({
        className: "",
        html: `<span class="marker-dot" style="background:#0f766e;width:36px;height:36px;border-width:4px"></span>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    }).addTo(map);
    markerRef.current = marker;

    const initial = { latitude: center[0], longitude: center[1] };
    setPicked(initial);

    // Update picked on drag
    marker.on("dragend", () => {
      const ll = marker.getLatLng();
      setPicked({ latitude: ll.lat, longitude: ll.lng });
    });

    // Click anywhere on map to move marker
    map.on("click", (e) => {
      marker.setLatLng(e.latlng);
      setPicked({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });

    // Ensure tiles render properly in modal
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialCenter]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden"
           style={{ maxHeight: "90vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-civic" />
            <div>
              <p className="font-bold text-ink">Pick location on map</p>
              <p className="text-xs text-slate-500">Tap or drag the pin to the exact issue location</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Map */}
        <div ref={mapNodeRef} className="flex-1 z-0" style={{ height: "420px", minHeight: "320px" }} />

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3 space-y-2">
          {picked && (
            <p className="text-xs text-slate-500 text-center">
              📍 {picked.latitude.toFixed(6)}, {picked.longitude.toFixed(6)}
            </p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!picked}
            onClick={() => onConfirm(picked)}
          >
            <Check size={17} />
            Use this location
          </button>
        </div>
      </div>
    </div>
  );
}

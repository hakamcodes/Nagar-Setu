import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapPin, X, Check, Navigation } from "lucide-react";

/**
 * LocationPickerModal — a full-screen Leaflet map modal.
 * A fixed crosshair sits at the center of the map at all times.
 * The user pans/zooms the map to the desired location, then taps
 * "Drop Pin here" to lock that center coordinate as the picked location.
 * On confirm, calls onConfirm({ latitude, longitude }).
 */
export default function LocationPickerModal({ onConfirm, onClose, initialCenter }) {
  const mapNodeRef = useRef(null);
  const mapRef = useRef(null);
  const [centerCoords, setCenterCoords] = useState(null);
  const [dropped, setDropped] = useState(null); // coords after user taps "Drop Pin"

  useEffect(() => {
    if (!mapNodeRef.current || mapRef.current) return;

    const center = initialCenter
      ? [initialCenter.latitude, initialCenter.longitude]
      : [23.2599, 77.4126]; // Default: Bhopal

    const map = L.map(mapNodeRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView(center, 15);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Track center as user pans
    const updateCenter = () => {
      const ll = map.getCenter();
      setCenterCoords({ latitude: ll.lat, longitude: ll.lng });
    };

    map.on("move", updateCenter);
    map.on("moveend", updateCenter);

    // Set initial center coords
    setCenterCoords({ latitude: center[0], longitude: center[1] });

    // Ensure tiles render properly in modal
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.off("move", updateCenter);
      map.off("moveend", updateCenter);
      map.remove();
      mapRef.current = null;
    };
  }, [initialCenter]);

  function handleDropPin() {
    if (centerCoords) setDropped(centerCoords);
  }

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
              <p className="text-xs text-slate-500">
                Pan the map to your location, then tap <strong>Drop Pin here</strong>
              </p>
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

        {/* Map + crosshair overlay */}
        <div className="relative flex-1" style={{ height: "420px", minHeight: "320px" }}>
          <div ref={mapNodeRef} className="absolute inset-0 z-0" />

          {/* Fixed crosshair at map center */}
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            {/* Outer ring */}
            <div className="relative flex items-center justify-center">
              <span
                className="absolute rounded-full border-2 border-teal-600/40"
                style={{ width: 48, height: 48 }}
              />
              {/* Crosshair lines */}
              <span className="absolute h-px w-8 bg-teal-700/60" />
              <span className="absolute w-px h-8 bg-teal-700/60" />
              {/* Center dot */}
              <span
                className="relative rounded-full bg-teal-600 shadow-md"
                style={{ width: 10, height: 10, boxShadow: "0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.35)" }}
              />
            </div>
          </div>

          {/* Drop pin button — floats at bottom of map */}
          <div className="absolute bottom-3 left-0 right-0 z-20 flex justify-center px-4">
            <button
              type="button"
              onClick={handleDropPin}
              className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-teal-700 active:scale-95 transition"
            >
              <Navigation size={16} />
              Drop Pin here
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-4 py-3 space-y-2">
          {dropped ? (
            <p className="text-xs text-teal-700 font-semibold text-center">
              📍 Pin dropped at {dropped.latitude.toFixed(6)}, {dropped.longitude.toFixed(6)}
            </p>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              Pan the map, then tap <strong>Drop Pin here</strong> to select a location
            </p>
          )}
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!dropped}
            onClick={() => onConfirm(dropped)}
          >
            <Check size={17} />
            Use this location
          </button>
        </div>
      </div>
    </div>
  );
}

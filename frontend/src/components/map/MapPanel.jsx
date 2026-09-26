import { useEffect, useRef } from "react";
import L from "leaflet";
import { getAreaLabel, getRegion, getZonesForRegion } from "../../config/regions.js";
import { loadCityGis } from "../../services/geoService.js";

const statusColors = {
  Open: "#2563eb",
  Triaged: "#d97706",
  "In Progress": "#0f766e",
  Resolved: "#059669",
  Duplicate: "#64748b",
  Rejected: "#dc2626",
};

function makeIcon(color) {
  return L.divIcon({
    className: "",
    html: `<span class="marker-dot" style="background:${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function MapPanel({ complaints = [], regionId = "bhopal", height = 520, filters = {} }) {
  const nodeRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const boundaryLayerRef = useRef(null);
  const region = getRegion(regionId);
  const regionZones = getZonesForRegion(regionId);
  const areaLabel = getAreaLabel(regionId);

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    mapRef.current = L.map(nodeRef.current, { scrollWheelZoom: true }).setView(
      [region.defaultCenterLat, region.defaultCenterLng],
      region.zoomLevel,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapRef.current);
  }, [region.defaultCenterLat, region.defaultCenterLng, region.zoomLevel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || region.geoMode !== "polygon") return undefined;
    let cancelled = false;

    loadCityGis(region).then((gis) => {
      if (cancelled || !gis) return;
      boundaryLayerRef.current?.remove();
      const layers = [];
      if (gis.wards) {
        layers.push(
          L.geoJSON(gis.wards, {
            style: { color: "#0f766e", weight: 1, fillOpacity: 0.03 },
            onEachFeature: (feature, layer) => {
              layer.bindTooltip(`${areaLabel} ${feature.properties.wardNumber} - ${feature.properties.wardName}`, { sticky: true });
            },
          }),
        );
      }
      if (gis.zones) {
        layers.push(
          L.geoJSON(gis.zones, {
            style: { color: "#7c3aed", weight: 1, dashArray: "4 4", fillOpacity: 0 },
          }),
        );
      }
      // Real ward/zone office locations - only available for Bhopal in this dataset.
      if (gis.wardOffices || gis.zoneOffices) {
        layers.push(
          L.geoJSON([...(gis.wardOffices?.features || []), ...(gis.zoneOffices?.features || [])], {
            pointToLayer: (feature, latlng) =>
              L.circleMarker(latlng, { radius: 4, color: "#334155", fillColor: "#94a3b8", fillOpacity: 0.9, weight: 1 }),
            onEachFeature: (feature, layer) => layer.bindTooltip(feature.properties.label || "Office", { sticky: true }),
          }),
        );
      }
      boundaryLayerRef.current = L.layerGroup(layers).addTo(map);
    });

    return () => {
      cancelled = true;
    };
  }, [region]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((layer) => layer.remove());
    markersRef.current = [];

    regionZones.forEach((zone) => {
      const circle = L.circle([zone.latitude, zone.longitude], {
        radius: zone.radiusMeters,
        color: "#0f766e",
        fillColor: "#0f766e",
        fillOpacity: 0.08,
        weight: 1,
      }).addTo(map);
      circle.bindPopup(`<strong>${zone.name}</strong><br>${zone.landmark || zone.type}`);
      markersRef.current.push(circle);
    });

    complaints
      .filter((item) => !item.regionId || item.regionId === regionId)
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => !filters.category || item.aiCategory === filters.category)
      .filter((item) => !filters.priority || item.aiPriority === filters.priority)
      .filter((item) => !filters.ward || item.ward?.number === filters.ward)
      .filter((item) => !filters.zone || String(item.zone?.number) === String(filters.zone))
      .filter((item) => item.latitude && item.longitude)
      .forEach((complaint) => {
        const marker = L.marker([complaint.latitude, complaint.longitude], {
          icon: makeIcon(statusColors[complaint.status] || "#2563eb"),
        }).addTo(map);
        marker.bindPopup(`
          <strong>${complaint.aiCategory}</strong><br>
          ${complaint.ward ? `${areaLabel} ${complaint.ward.number} - ${complaint.ward.name}` : complaint.zoneName || "Unmapped"}<br>
          ${complaint.status} - ${complaint.supportCount || 0} supporters
        `);
        markersRef.current.push(marker);
      });

    window.setTimeout(() => map.invalidateSize(), 150);
  }, [complaints, filters.category, filters.priority, filters.status, filters.ward, filters.zone, regionId, regionZones]);

  return <div ref={nodeRef} className="z-0 w-full overflow-hidden rounded-lg border border-slate-200" style={{ height }} />;
}

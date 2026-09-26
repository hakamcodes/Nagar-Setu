import { useEffect, useState } from "react";
import AdminNav from "./AdminNav.jsx";
import MapPanel from "../../components/map/MapPanel.jsx";
import { getAreaLabel, getRegion, getZonesForRegion } from "../../config/regions.js";
import { loadCityGis } from "../../services/geoService.js";
import { useData } from "../../state/DataContext.jsx";

export default function AdminZones() {
  const { complaints } = useData();
  const region = getRegion();
  const isPolygonRegion = region.geoMode === "polygon";
  const isCampus = region.type === "campus";
  const areaLabel = getAreaLabel(region.regionId);
  const zones = getZonesForRegion(region.regionId);
  const [gis, setGis] = useState(null);

  useEffect(() => {
    if (!isPolygonRegion) return;
    loadCityGis(region).then(setGis);
  }, [isPolygonRegion, region]);

  return (
    <section className="section">
      <AdminNav />
      <div className="mb-6">
        <p className="eyebrow">Region configuration</p>
        <h1 className="page-title">{isPolygonRegion ? (isCampus ? "Campus areas" : "Wards & zones") : "Admin zone management"}</h1>
        <p className="page-subtitle">
          {isPolygonRegion
            ? isCampus
              ? `${region.name} campus areas are detected automatically from hand-mapped campus boundaries - no manual zone entry.`
              : `${region.name} wards and zones are detected automatically from real ${region.municipality} GIS boundaries - no manual zone entry.`
            : "SATI Vidisha is the legacy demo region. Add future cities, campuses, wards, districts, and zones as records with center coordinates and radii."}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="card max-h-[640px] overflow-y-auto p-5">
          <h2 className="text-xl font-black">{region.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Type</span><strong>{region.type}</strong></div>
            <div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">State</span><strong>{region.state}</strong></div>
            <div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Center</span><strong>{region.defaultCenterLat}, {region.defaultCenterLng}</strong></div>
            <div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Default zoom</span><strong>{region.zoomLevel}</strong></div>
          </div>

          {isPolygonRegion ? (
            <div className="mt-5 space-y-3">
              {!gis && (
                <div className="space-y-3">
                  {[0, 1, 2].map((key) => <div key={key} className="h-20 animate-pulse rounded-lg bg-slate-100" />)}
                </div>
              )}
              {gis?.wards.features.map((feature) => (
                <div key={feature.properties.wardNumber} className="rounded-lg border border-slate-200 p-3 transition hover:border-civic/40 hover:bg-teal-50/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{areaLabel} {feature.properties.wardNumber} - {feature.properties.wardName}</p>
                      {isCampus ? (
                        <p className="text-sm text-slate-500">{feature.properties.description || "-"}</p>
                      ) : (
                        <p className="text-sm text-slate-500">Population {feature.properties.population ?? "n/a"}</p>
                      )}
                    </div>
                    {!isCampus && (
                      <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-civic">Zone {feature.properties.zoneNumber ?? "-"}</span>
                    )}
                  </div>
                  {!isCampus && (
                    <>
                      <p className="mt-2 text-xs text-slate-500">Corporator: {feature.properties.corporator || "-"}</p>
                      <p className="text-xs text-slate-500">Ward officer: {feature.properties.wardOfficer || "-"}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {zones.map((zone) => (
                <div key={zone.zoneId} className="rounded-lg border border-slate-200 p-3 transition hover:border-civic/40 hover:bg-teal-50/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black">{zone.name}</p>
                      <p className="text-sm text-slate-500">{zone.landmark}</p>
                    </div>
                    <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-civic">{zone.radiusMeters}m</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{zone.latitude}, {zone.longitude}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-3">
          <MapPanel complaints={complaints} regionId={region.regionId} height={620} />
        </div>
      </div>
    </section>
  );
}

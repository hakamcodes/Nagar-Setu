import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import { getZonesForRegion } from "../config/regions.js";
import { detectNearestZone } from "../utils/geo.js";

const gisCache = new Map();
const reverseGeocodeCache = new Map();

async function fetchGeoJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

// Fetches a GIS layer only if the region config defines a URL for it - SATI
// and Delhi only ship a subset of the layers Bhopal has (no zones/offices),
// so missing layers resolve to null instead of being fetched.
function fetchOptionalGeoJson(url) {
  return url ? fetchGeoJson(url) : Promise.resolve(null);
}

export async function loadCityGis(region) {
  if (region.geoMode !== "polygon" || !region.gis) return null;
  if (gisCache.has(region.regionId)) return gisCache.get(region.regionId);

  const load = (async () => {
    const [wards, zones, cityBoundary, wardOffices, zoneOffices] = await Promise.all([
      fetchOptionalGeoJson(region.gis.wardsUrl),
      fetchOptionalGeoJson(region.gis.zonesUrl),
      fetchOptionalGeoJson(region.gis.cityBoundaryUrl),
      fetchOptionalGeoJson(region.gis.wardOfficesUrl),
      fetchOptionalGeoJson(region.gis.zoneOfficesUrl),
    ]);
    return { wards, zones, cityBoundary, wardOffices, zoneOffices };
  })();

  gisCache.set(region.regionId, load);
  return load;
}

// Planar shoelace-formula area in raw lng/lat units. Not a true geographic
// area, but accurate enough to rank overlapping polygons by size - good
// enough since we only ever compare rings within the same small dataset.
function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function polygonArea(geometry) {
  if (geometry.type === "Polygon") return ringArea(geometry.coordinates[0] || []);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.reduce((total, polygon) => total + ringArea(polygon[0] || []), 0);
  }
  return Infinity;
}

// Some datasets (e.g. a campus outline polygon that encloses every named
// building/area within it) have deliberately overlapping boundaries. When a
// point falls inside more than one, the most specific (smallest) polygon is
// the meaningful match, not just whichever happens to come first in the file.
function findContainingFeature(pt, featureCollection) {
  if (!featureCollection?.features?.length) return null;
  const matches = featureCollection.features.filter((feature) => {
    try {
      return booleanPointInPolygon(pt, feature);
    } catch {
      return false;
    }
  });
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches.reduce((smallest, feature) =>
    polygonArea(feature.geometry) < polygonArea(smallest.geometry) ? feature : smallest,
  );
}

// Deterministic polygon containment only. This never guesses a ward/zone: if
// the point falls outside every polygon, the corresponding field is null.
export async function locateWard(location, region) {
  if (region.geoMode !== "polygon") return { ward: null, zone: null, withinCity: null };

  const gis = await loadCityGis(region);
  const pt = point([location.longitude, location.latitude]);

  const wardFeature = findContainingFeature(pt, gis.wards);
  const zoneFeature = findContainingFeature(pt, gis.zones);
  const withinCity = gis.cityBoundary ? Boolean(findContainingFeature(pt, gis.cityBoundary)) : null;

  const ward = wardFeature
    ? {
        number: wardFeature.properties.wardNumber ?? null,
        name: wardFeature.properties.wardName ?? null,
        lgdCode: wardFeature.properties.wardLgdCode ?? null,
        zoneNumber: wardFeature.properties.zoneNumber ?? null,
        corporator: wardFeature.properties.corporator ?? null,
        corporatorMobile: wardFeature.properties.corporatorMobile ?? null,
        wardOfficer: wardFeature.properties.wardOfficer ?? null,
        wardOfficerMobile: wardFeature.properties.wardOfficerMobile ?? null,
        population: wardFeature.properties.population ?? null,
      }
    : null;

  // Zone is resolved independently from the real zone-boundary polygons, not
  // from the ward's cross-referenced zone number, so it stays accurate even if
  // ward/zone numbering has drifted between source datasets.
  const zone = zoneFeature
    ? {
        number: zoneFeature.properties.zoneNumber ?? null,
        officerName: zoneFeature.properties.zoneOfficerName ?? null,
        officerMobile: zoneFeature.properties.zoneOfficerMobile ?? null,
      }
    : null;

  return { ward, zone, withinCity };
}

function extractAddress(nominatimResult) {
  if (!nominatimResult) return null;
  const address = nominatimResult.address || {};
  const locality =
    address.suburb || address.neighbourhood || address.village || address.town || address.city_district || "";
  return {
    road: address.road || "",
    locality,
    city: address.city || address.town || address.state_district || "",
    state: address.state || "",
    postcode: address.postcode || "",
    formattedAddress: nominatimResult.display_name || "",
  };
}

// OpenStreetMap Nominatim reverse geocoding. Free, no API key, subject to a
// ~1 req/sec fair-use rate limit — fine for a hackathon demo, cached per
// rounded coordinate, and never blocks complaint submission on failure.
export async function reverseGeocode(location) {
  const key = `${location.latitude.toFixed(5)},${location.longitude.toFixed(5)}`;
  if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${location.latitude}&lon=${location.longitude}&zoom=18&addressdetails=1`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Reverse geocoding request failed.");
    const data = await response.json();
    const address = extractAddress(data) || {
      road: "",
      locality: "",
      city: "",
      state: "",
      postcode: "",
      formattedAddress: "Address unavailable",
    };
    reverseGeocodeCache.set(key, address);
    return address;
  } catch (error) {
    console.warn("Reverse geocoding failed.", error);
    return { road: "", locality: "", city: "", state: "", postcode: "", formattedAddress: "Address unavailable" };
  }
}

export async function resolveLocationIntelligence(location, region) {
  if (region.geoMode === "circle") {
    const detected = detectNearestZone(location, getZonesForRegion(region.regionId));
    const address = await reverseGeocode(location);
    return {
      geoMode: "circle",
      zoneDetection: detected,
      ward: null,
      zone: null,
      withinCity: null,
      address,
    };
  }

  const [{ ward, zone, withinCity }, address] = await Promise.all([
    locateWard(location, region),
    reverseGeocode(location),
  ]);

  return { geoMode: "polygon", zoneDetection: null, ward, zone, withinCity, address };
}

// One-time conversion of the raw Bhopal GIS sources in data/ into the
// normalized, camelCase GeoJSON files the app fetches at runtime from
// public/gis/bhopal/. Re-run this script (`node scripts/convert-bhopal-gis.mjs`)
// whenever the source files in data/ are updated.
//
// Sources (see data/Bhopal/Readme.md for provenance):
// - data/dataSet.kml                              2024 official LGD ward boundaries (primary ward polygons)
// - data/Bhopal/Bhopal_wards.geojson              BMC informative-map wards (zone number + officer/corporator contacts)
// - data/Bhopal/Zone_Boundary.geojson             real BMC zone polygons + zone officer contacts
// - data/Bhopal/Planning_ Boundary_ 2031.geojson  Bhopal city planning-limit polygon
// - data/Bhopal/Ward_Offices.geojson              ward office point locations
// - data/Bhopal/Zone_Offices.geojson              zone office point locations
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOMParser } from "@xmldom/xmldom";
import { kml } from "@tmcw/togeojson";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dataDir = path.join(root, "data");
const bhopalDataDir = path.join(dataDir, "Bhopal");
const outDir = path.join(root, "public", "gis", "bhopal");

fs.mkdirSync(outDir, { recursive: true });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(value));
  console.log(`wrote public/gis/bhopal/${fileName}`);
}

function normalizeWardNumber(value) {
  return String(value ?? "").trim().replace(/^0+(?=\d)/, "");
}

// togeojson turns a KML <MultiGeometry> containing several <Polygon> children into
// a GeoJSON GeometryCollection, which turf's boolean-point-in-polygon can't consume
// directly. Flatten any Polygon-only GeometryCollection into a single MultiPolygon
// so every ward feature is a plain Polygon or MultiPolygon at runtime.
function normalizeGeometry(geometry) {
  if (!geometry) return geometry;
  if (geometry.type !== "GeometryCollection") return geometry;
  const allPolygons = geometry.geometries.every((g) => g.type === "Polygon");
  if (!allPolygons) return geometry;
  return {
    type: "MultiPolygon",
    coordinates: geometry.geometries.map((g) => g.coordinates),
  };
}

// --- 1. Ward polygons (primary source: 2024 official LGD KML) ---
const kmlText = fs.readFileSync(path.join(dataDir, "dataSet.kml"), "utf8");
const kmlDoc = new DOMParser().parseFromString(kmlText, "text/xml");
const wardsFromKml = kml(kmlDoc);

// --- 2. Zone number + officer/corporator contacts (BMC informative-map wards) ---
const bmcWards = readJson(path.join(bhopalDataDir, "Bhopal_wards.geojson"));
const bmcWardByNumber = new Map();
for (const feature of bmcWards.features) {
  const props = feature.properties || {};
  const number = normalizeWardNumber(props.Ward_Number);
  if (!number) continue;
  bmcWardByNumber.set(number, {
    zoneNumber: props.zone ? Number(props.zone) : null,
    corporator: props.corporator || "",
    corporatorMobile: props.corporator_mobile || "",
    wardOfficer: props.ward_officer || "",
    wardOfficerMobile: props.ward_officer_mobile || "",
    population: props.population ? Number(props.population) : null,
  });
}

let joined = 0;
const wardFeatures = wardsFromKml.features
  .filter((feature) => feature.geometry)
  .map((feature) => {
    const props = feature.properties || {};
    const wardNumber = normalizeWardNumber(props.sourcewardcode);
    const bmcInfo = bmcWardByNumber.get(wardNumber) || null;
    if (bmcInfo) joined += 1;
    return {
      type: "Feature",
      geometry: normalizeGeometry(feature.geometry),
      properties: {
        wardNumber,
        wardName: props.ward_lgd_name || props.sourcewardname || "",
        wardLgdCode: props.ward_lgd_code || null,
        townName: props.townname || "",
        state: props.state || "",
        zoneNumber: bmcInfo?.zoneNumber ?? null,
        corporator: bmcInfo?.corporator ?? "",
        corporatorMobile: bmcInfo?.corporatorMobile ?? "",
        wardOfficer: bmcInfo?.wardOfficer ?? "",
        wardOfficerMobile: bmcInfo?.wardOfficerMobile ?? "",
        population: bmcInfo?.population ?? null,
      },
    };
  });

console.log(`wards: ${wardFeatures.length} total, ${joined} joined to BMC officer/zone data`);

writeJson("wards.geojson", { type: "FeatureCollection", features: wardFeatures });

// --- 3. Zone polygons ---
const zoneBoundary = readJson(path.join(bhopalDataDir, "Zone_Boundary.geojson"));
const zoneFeatures = zoneBoundary.features.map((feature) => {
  const props = feature.properties || {};
  return {
    type: "Feature",
    geometry: feature.geometry,
    properties: {
      zoneNumber: props.zone_no ?? null,
      zoneOfficerName: props.zone_officer_name || "",
      zoneOfficerMobile: props.zone_officer_number || "",
    },
  };
});
writeJson("zones.geojson", { type: "FeatureCollection", features: zoneFeatures });

// --- 4. City planning boundary ---
const planningBoundary = readJson(path.join(bhopalDataDir, "Planning_ Boundary_ 2031.geojson"));
writeJson("city-boundary.geojson", planningBoundary);

// --- 5. Office point layers ---
function convertOffices(fileName, prefix) {
  const source = readJson(path.join(bhopalDataDir, fileName));
  return {
    type: "FeatureCollection",
    features: source.features.map((feature) => {
      const props = feature.properties || {};
      const match = String(props.sn || "").match(/(\d+)/);
      return {
        type: "Feature",
        geometry: feature.geometry,
        properties: {
          number: match ? Number(match[1]) : null,
          label: props.sn || "",
        },
      };
    }),
  };
}

writeJson("ward-offices.geojson", convertOffices("Ward_Offices.geojson", "ward"));
writeJson("zone-offices.geojson", convertOffices("Zone_Offices.geojson", "zone"));

console.log("Bhopal GIS conversion complete.");

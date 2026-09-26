// One-time conversion of the raw Delhi GIS sources in data/Delhi/ into the
// normalized GeoJSON the app fetches at runtime from public/gis/delhi/.
// Re-run this script (`node scripts/convert-delhi-gis.mjs`) whenever the
// source files in data/Delhi/ are updated.
//
// Sources (see data/Delhi/Readme.md for provenance):
// - data/Delhi/Delhi_Wards.geojson     ward boundaries (Ward_No/Ward_Name only - no zone/officer layer)
// - data/Delhi/Delhi_Boundary.geojson  city boundary
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const delhiDataDir = path.join(root, "data", "Delhi");
const outDir = path.join(root, "public", "gis", "delhi");

fs.mkdirSync(outDir, { recursive: true });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(value));
  console.log(`wrote public/gis/delhi/${fileName}`);
}

// --- Ward polygons (no zone number / officer contacts in this dataset) ---
const wards = readJson(path.join(delhiDataDir, "Delhi_Wards.geojson"));
const wardFeatures = wards.features
  .filter((feature) => feature.geometry)
  .map((feature) => {
    const props = feature.properties || {};
    return {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        wardNumber: String(props.Ward_No ?? ""),
        wardName: props.Ward_Name || "",
      },
    };
  });
writeJson("wards.geojson", { type: "FeatureCollection", features: wardFeatures });

// --- City boundary (pass-through) ---
const boundary = readJson(path.join(delhiDataDir, "Delhi_Boundary.geojson"));
writeJson("city-boundary.geojson", boundary);

console.log(`Delhi GIS conversion complete (${wardFeatures.length} wards).`);

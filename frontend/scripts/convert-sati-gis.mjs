// One-time conversion of the hand-drawn SATI campus zone polygons into the
// normalized GeoJSON the app fetches at runtime from public/gis/sati/.
// Re-run this script (`node scripts/convert-sati-gis.mjs`) whenever
// data/SATI/sati-campus.geojson is updated.
//
// SATI has no separate zone layer, city boundary, or office point data -
// each campus area (Academic Block, hostels, grounds, etc.) is treated as a
// single "ward"-equivalent polygon, matching the property shape
// locateWard() in geoService.js expects (wardNumber/wardName).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const sourcePath = path.join(root, "data", "SATI", "sati-campus.geojson");
const outDir = path.join(root, "public", "gis", "sati");

fs.mkdirSync(outDir, { recursive: true });

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

const wardFeatures = source.features
  .filter((feature) => feature.geometry)
  .map((feature, index) => {
    const props = feature.properties || {};
    return {
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        wardNumber: String(index + 1),
        wardName: props.name || `Campus Area ${index + 1}`,
        description: props.description || "",
      },
    };
  });

fs.writeFileSync(
  path.join(outDir, "wards.geojson"),
  JSON.stringify({ type: "FeatureCollection", features: wardFeatures }),
);
console.log(`wrote public/gis/sati/wards.geojson (${wardFeatures.length} campus areas)`);

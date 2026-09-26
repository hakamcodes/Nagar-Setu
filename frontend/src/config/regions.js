import { bhopalDepartments, resolveBhopalDepartment } from "./departments.bhopal.js";
import { delhiDepartments, resolveDelhiDepartment } from "./departments.delhi.js";

export const issueCategories = [
  "Road Damage",
  "Garbage",
  "Streetlight",
  "Waterlogging",
  "Blocked Drain",
  "Water Leak",
  "Electrical",
  "Hostel Maintenance",
  "Sanitation",
  "Broken Furniture",
  "Safety Hazard",
  "Illegal Construction",
  "Stray Animal",
  "Tree / Garden Maintenance",
  "Traffic / Signage",
  "Other",
];

export const priorities = ["Low", "Medium", "High", "Critical"];

export const complaintStatuses = [
  "Open",
  "Triaged",
  "In Progress",
  "Resolved",
  "Duplicate",
  "Rejected",
];

export const departments = [
  "Civil Maintenance",
  "Electrical Department",
  "Sanitation Team",
  "Hostel Administration",
  "Water Works",
  "Security Office",
  "Campus Administration",
];

export const regions = [
  {
    regionId: "bhopal",
    name: "Bhopal",
    type: "city",
    geoMode: "polygon",
    country: "India",
    state: "Madhya Pradesh",
    district: "Bhopal",
    municipality: "Bhopal Municipal Corporation",
    active: true,
    defaultCenterLat: 23.2599,
    defaultCenterLng: 77.4126,
    zoomLevel: 12,
    tagline: "Bhopal civic-intelligence pilot for the Cloud Impact Lab Hackathon.",
    departments: bhopalDepartments,
    gis: {
      wardsUrl: "/gis/bhopal/wards.geojson",
      zonesUrl: "/gis/bhopal/zones.geojson",
      cityBoundaryUrl: "/gis/bhopal/city-boundary.geojson",
      wardOfficesUrl: "/gis/bhopal/ward-offices.geojson",
      zoneOfficesUrl: "/gis/bhopal/zone-offices.geojson",
    },
  },

];

export const zones = [];

export const defaultRegionId = import.meta.env.VITE_DEFAULT_REGION_ID || "bhopal";

export function getRegion(regionId = defaultRegionId) {
  return regions.find((region) => region.regionId === regionId) || regions[0];
}

export function getZonesForRegion(regionId = defaultRegionId) {
  return zones.filter((zone) => zone.regionId === regionId && zone.active);
}

export function getDepartmentsForRegion(regionId = defaultRegionId) {
  return getRegion(regionId).departments || departments;
}

// City regions detect real municipal wards; a campus region (SATI) has no
// wards, just named campus areas (Academic Block, hostels, grounds...), so
// the UI label must not call them "Ward" even though they reuse the same
// wardNumber/wardName GIS property shape internally.
export function getAreaLabel(regionId = defaultRegionId) {
  return getRegion(regionId).type === "campus" ? "Area" : "Ward";
}

const satiDepartmentByCategory = {
  "Road Damage": "Civil Maintenance",
  Garbage: "Sanitation Team",
  Streetlight: "Electrical Department",
  Waterlogging: "Civil Maintenance",
  "Blocked Drain": "Sanitation Team",
  "Water Leak": "Water Works",
  Electrical: "Electrical Department",
  "Hostel Maintenance": "Hostel Administration",
  Sanitation: "Sanitation Team",
  "Broken Furniture": "Campus Administration",
  "Safety Hazard": "Security Office",
  Other: "Campus Administration",
};

// Deterministic category -> department routing, kept out of the AI's hands.
// The AI may only *suggest* a department (shown for transparency); this map
// always decides the department actually stored on a complaint.
export function resolveDepartmentForCategory(category, regionId = defaultRegionId) {
  if (regionId === "bhopal") return resolveBhopalDepartment(category);
  if (regionId === "delhi") return resolveDelhiDepartment(category);
  return satiDepartmentByCategory[category] || departments[departments.length - 1];
}

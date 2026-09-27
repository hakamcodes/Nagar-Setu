import { bhopalDepartments, resolveBhopalDepartment } from "./departments.bhopal.js";

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

// Returns the label for an area unit — "Ward" for cities.
export function getAreaLabel(regionId = defaultRegionId) {
  return "Ward";
}

// Deterministic category -> department routing, kept out of the AI's hands.
// The AI may only *suggest* a department (shown for transparency); this map
// always decides the department actually stored on a complaint.
export function resolveDepartmentForCategory(category, regionId = defaultRegionId) {
  return resolveBhopalDepartment(category);
}

// Delhi civic department structure. Delhi's municipal data in this repo is
// ward-boundary-only (no zone/officer layer), so department routing here is
// a generic MCD/NDMC-style category map - deterministic, same pattern as
// Bhopal: the AI may *suggest* a department for transparency, but this map
// always decides the department actually stored on a complaint.
export const delhiDepartments = [
  "Public Works Department",
  "Sanitation & Solid Waste Management",
  "Electrical Maintenance",
  "Water Supply (Delhi Jal Board)",
  "Drainage & Sewerage",
  "Health Department",
  "Horticulture & Parks",
  "Fire & Emergency Services",
  "Building & Town Planning",
  "Public Grievance Cell",
];

const categoryToDepartment = {
  "Road Damage": "Public Works Department",
  Garbage: "Sanitation & Solid Waste Management",
  Streetlight: "Electrical Maintenance",
  Waterlogging: "Drainage & Sewerage",
  "Blocked Drain": "Drainage & Sewerage",
  "Water Leak": "Water Supply (Delhi Jal Board)",
  Electrical: "Electrical Maintenance",
  Sanitation: "Health Department",
  "Broken Furniture": "Public Grievance Cell",
  "Safety Hazard": "Fire & Emergency Services",
  "Illegal Construction": "Building & Town Planning",
  "Stray Animal": "Health Department",
  "Tree / Garden Maintenance": "Horticulture & Parks",
  "Traffic / Signage": "Public Works Department",
  "Hostel Maintenance": "Public Grievance Cell",
  Other: "Public Grievance Cell",
};

export function resolveDelhiDepartment(category) {
  return categoryToDepartment[category] || "Public Grievance Cell";
}

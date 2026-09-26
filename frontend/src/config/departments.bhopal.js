// Bhopal Municipal Corporation (BMC) department structure.
//
// Sourced from BMC's public service listing (bhopalmunicipal.com exposes, among
// others, "Solid Waste Management" and "Electricity Branch" as named services)
// plus corroborating BMC administrative structure from public records
// (Wikipedia: Bhopal Municipal Corporation; indiaonlinepages.com BMC department
// listing). These are real department names, not invented ones — see README for
// sources. Department routing here is deterministic: the AI may *suggest* a
// department for transparency, but the category -> department map below always
// decides what gets stored on the complaint.
export const bhopalDepartments = [
  "Public Works Department",
  "Solid Waste Management Department",
  "Electricity Branch",
  "Water Supply Department",
  "Sewerage & Drainage Section",
  "Health & Sanitation Department",
  "Horticulture Department",
  "Fire & Emergency Services",
  "Town Planning & Building Permission Department",
  "General Administration / Public Grievance Cell",
];

const categoryToDepartment = {
  "Road Damage": "Public Works Department",
  Garbage: "Solid Waste Management Department",
  Streetlight: "Electricity Branch",
  Waterlogging: "Sewerage & Drainage Section",
  "Blocked Drain": "Sewerage & Drainage Section",
  "Water Leak": "Water Supply Department",
  Electrical: "Electricity Branch",
  Sanitation: "Health & Sanitation Department",
  "Broken Furniture": "General Administration / Public Grievance Cell",
  "Safety Hazard": "Fire & Emergency Services",
  "Illegal Construction": "Town Planning & Building Permission Department",
  "Stray Animal": "Health & Sanitation Department",
  "Tree / Garden Maintenance": "Horticulture Department",
  "Traffic / Signage": "Public Works Department",
  "Hostel Maintenance": "General Administration / Public Grievance Cell",
  Other: "General Administration / Public Grievance Cell",
};

export function resolveBhopalDepartment(category) {
  return categoryToDepartment[category] || "General Administration / Public Grievance Cell";
}

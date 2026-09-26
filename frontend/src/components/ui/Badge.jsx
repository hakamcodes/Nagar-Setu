const statusClass = {
  Open: "bg-blue-50 text-blue-800 border-blue-200",
  Triaged: "bg-amber-50 text-amber-800 border-amber-200",
  "In Progress": "bg-teal-50 text-teal-800 border-teal-200",
  Resolved: "bg-emerald-50 text-emerald-800 border-emerald-200",
  Duplicate: "bg-slate-100 text-slate-700 border-slate-200",
  Rejected: "bg-red-50 text-red-800 border-red-200",
};

const statusDot = {
  Open: "bg-blue-600",
  Triaged: "bg-amber-600",
  "In Progress": "bg-teal-600",
  Resolved: "bg-emerald-600",
  Duplicate: "bg-slate-500",
  Rejected: "bg-red-600",
};

const priorityClass = {
  Low: "bg-slate-100 text-slate-700 border-slate-200",
  Medium: "bg-yellow-50 text-yellow-800 border-yellow-200",
  High: "bg-orange-50 text-orange-800 border-orange-200",
  Critical: "bg-red-50 text-red-800 border-red-200",
};

const priorityDot = {
  Low: "bg-slate-500",
  Medium: "bg-yellow-600",
  High: "bg-orange-600",
  Critical: "bg-red-600",
};

export function Badge({ children, className = "", dotClassName = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold shadow-sm ${className}`}>
      {dotClassName && <span className={`h-1.5 w-1.5 flex-none rounded-full ${dotClassName}`} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <Badge className={statusClass[status] || statusClass.Open} dotClassName={statusDot[status] || statusDot.Open}>
      {status || "Open"}
    </Badge>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <Badge className={priorityClass[priority] || priorityClass.Medium} dotClassName={priorityDot[priority] || priorityDot.Medium}>
      {priority || "Medium"}
    </Badge>
  );
}

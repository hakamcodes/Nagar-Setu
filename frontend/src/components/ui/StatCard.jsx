export default function StatCard({ label, value, icon: Icon, tone = "teal" }) {
  const colors = {
    teal: "bg-teal-50 text-teal-800 ring-teal-100",
    blue: "bg-blue-50 text-blue-800 ring-blue-100",
    amber: "bg-amber-50 text-amber-800 ring-amber-100",
    rose: "bg-rose-50 text-rose-800 ring-rose-100",
  };

  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-ink">{value}</p>
        </div>
        {Icon && (
          <span className={`grid h-11 w-11 flex-none place-items-center rounded-lg ring-4 ${colors[tone] || colors.teal}`}>
            <Icon size={20} />
          </span>
        )}
      </div>
    </div>
  );
}

import { formatDateTime } from "../../utils/date.js";

export default function Timeline({ items = [] }) {
  return (
    <div className="space-y-4">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <div key={`${item.label}-${item.at}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`h-3 w-3 flex-none rounded-full ${
                  isLast ? "bg-civic ring-4 ring-teal-100" : "bg-slate-300"
                }`}
              />
              {!isLast && <span className="w-px flex-1 bg-gradient-to-b from-slate-200 to-slate-100" />}
            </div>
            <div className="pb-4">
              <p className={`text-sm font-bold ${isLast ? "text-ink" : "text-slate-600"}`}>{item.label}</p>
              <p className="text-xs text-slate-500">{formatDateTime(item.at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

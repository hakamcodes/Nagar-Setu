import { Flame, ListTree, MapPin, Tags } from "lucide-react";
import AdminNav from "./AdminNav.jsx";
import BarList from "../../components/ui/BarList.jsx";
import { useData } from "../../state/DataContext.jsx";

export default function AdminAnalytics() {
  const { analytics } = useData();

  return (
    <section className="section">
      <AdminNav />
      <div className="mb-6">
        <p className="eyebrow">AI-assisted insight</p>
        <h1 className="page-title">Analytics summary</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="card p-5">
          <h2 className="text-xl font-black">Admin summary</h2>
          <p className="mt-3 leading-7 text-slate-700">{analytics.adminSummary}</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-black">{analytics.unresolved}</p>
              <p className="text-sm text-slate-500">Unresolved</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-black">{analytics.duplicateClusters}</p>
              <p className="text-sm text-slate-500">Duplicate clusters</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-black">{analytics.resolutionRate}%</p>
              <p className="text-sm text-slate-500">Resolution rate</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-black">{analytics.avgResolutionHours ?? "-"}h</p>
              <p className="text-sm text-slate-500">Avg resolution time</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-black">{analytics.slaBreached}</p>
              <p className="text-sm text-slate-500">SLA breaches</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-2xl font-black">{analytics.hotspotCount}</p>
              <p className="text-sm text-slate-500">Active hotspots</p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><MapPin size={18} className="text-civic" /> Top wards</h2>
            <BarList items={analytics.topWardsList} />
          </div>
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Flame size={18} className="text-civic" /> Top zones</h2>
            <BarList items={analytics.topProblemZones} />
          </div>
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Tags size={18} className="text-civic" /> Top categories</h2>
            <BarList items={analytics.topCategories} />
          </div>
          <div className="card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><ListTree size={18} className="text-civic" /> Status trend</h2>
            <BarList items={analytics.byStatus} />
          </div>
        </div>
      </div>
    </section>
  );
}

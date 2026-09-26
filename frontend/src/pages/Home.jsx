import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CheckCircle2, Layers3, MapPinned, Radar, ShieldCheck, Sparkles, ThumbsUp } from "lucide-react";
import { buildAnalytics } from "../services/analyticsService.js";
import { getRegion } from "../config/regions.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useRegion } from "../state/RegionContext.jsx";
import StatCard from "../components/ui/StatCard.jsx";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";

const features = [
  { icon: MapPinned, title: "Real ward detection", text: "GPS is matched against real municipal ward and zone polygons using point-in-polygon containment, not manual selection." },
  { icon: Sparkles, title: "AI triage", text: "Complaints get category, severity, risk indicators, civic impact score, and a suggested department without replacing civic workflow logic." },
  { icon: Radar, title: "Duplicate control", text: "Nearby, similar, recent complaints are promoted for support instead of creating noisy duplicate records." },
  { icon: BarChart3, title: "Admin intelligence", text: "Moderators see hotspots, ward/zone trends, department performance, SLA breaches, assignments, and resolution actions." },
];

export default function Home() {
  const { isAdmin } = useAuth();
  const { complaints, officers } = useData();
  const { activeRegion } = useRegion();
  const region = getRegion(activeRegion);
  const regionComplaints = useMemo(
    () => complaints.filter((item) => !item.regionId || item.regionId === region.regionId),
    [complaints, region.regionId],
  );
  const analytics = useMemo(() => buildAnalytics(regionComplaints, officers), [officers, regionComplaints]);
  const latest = regionComplaints.slice(0, 3);

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[36rem] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(15,118,110,0.14),transparent)]"
        />
        <div className="section grid min-h-[calc(100vh-4rem)] items-center gap-8 py-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-fade-up">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800 shadow-sm">
                <ShieldCheck size={16} />
                Civic intelligence platform for {region.name}
              </span>

            </div>
            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-ink sm:text-6xl lg:text-7xl">
              Nagar <span className="text-civic">Setu</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700">
              A real-time civic complaint intelligence platform for {region.name}. Citizens report issues with GPS-detected wards and zones; {region.municipality || "municipal"} administrators receive mapped, deduplicated, prioritized, and department-routed work queues.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="btn-primary px-5 py-3">
                Report Issue <ArrowRight size={18} />
              </Link>
              <Link to="/complaints" className="btn-secondary px-5 py-3">
                View Live Complaints
              </Link>
              {isAdmin && (
                <Link to="/admin" className="btn-secondary px-5 py-3">
                  Admin Dashboard
                </Link>
              )}
            </div>
          </div>

          <div className="card overflow-hidden shadow-lift">
            <div className="bg-gradient-to-br from-ink to-teal-950 p-5 text-white">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-teal-100">Live pilot command view</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{region.name}</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-3xl font-black">{analytics.unresolved}</p>
                  <p className="text-sm text-slate-200">Unresolved</p>
                </div>
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-3xl font-black">{analytics.resolved}</p>
                  <p className="text-sm text-slate-200">Resolved</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {latest.map((complaint) => (
                <ComplaintCard key={complaint.complaintId} complaint={complaint} compact />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total complaints" value={analytics.total} icon={Layers3} tone="teal" />
        <StatCard label="Open" value={analytics.open} icon={Radar} tone="blue" />
        <StatCard label="In progress" value={analytics.inProgress} icon={ThumbsUp} tone="amber" />
        <StatCard label="Resolved" value={analytics.resolved} icon={CheckCircle2} tone="teal" />
      </section>

      <section className="section">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">Problem to workflow</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">From scattered complaints to accountable resolution.</h2>
          </div>
          <p className="text-base leading-7 text-slate-700">
            People should not need to know which office owns a pothole, drain, light, or maintenance issue. Nagar Setu captures the evidence, maps the zone, classifies the work, checks for duplicates, gathers public support, and gives authorities a single operational dashboard.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="card card-hover p-5">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-civic ring-4 ring-teal-100">
                <feature.icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

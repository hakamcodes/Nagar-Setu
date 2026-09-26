import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Flame, Gauge, Layers3, ShieldAlert } from "lucide-react";
import AdminNav from "./AdminNav.jsx";
import StatCard from "../../components/ui/StatCard.jsx";
import BarList from "../../components/ui/BarList.jsx";
import ComplaintCard from "../../components/complaints/ComplaintCard.jsx";
import MapPanel from "../../components/map/MapPanel.jsx";
import { getRegion } from "../../config/regions.js";
import { generateCivicBriefing } from "../../services/aiService.js";
import { buildAnalytics } from "../../services/analyticsService.js";
import { getVisibleComplaints } from "../../services/officerService.js";
import { useAuth } from "../../state/AuthContext.jsx";
import { useData } from "../../state/DataContext.jsx";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { complaints, officers } = useData();
  const region = getRegion();
  const scoped = useMemo(() => getVisibleComplaints(user, complaints), [complaints, user]);
  const analytics = useMemo(() => buildAnalytics(scoped, officers), [officers, scoped]);
  const recent = scoped.slice(0, 4);
  const [briefing, setBriefing] = useState(analytics.adminSummary);

  useEffect(() => {
    let cancelled = false;
    generateCivicBriefing(
      {
        open: analytics.open,
        highPriority: analytics.highPriority,
        slaBreached: analytics.slaBreached,
        topWard: analytics.topWard,
        hotspotCount: analytics.hotspotCount,
      },
      region,
    ).then((text) => {
      if (!cancelled) setBriefing(text);
    });
    return () => {
      cancelled = true;
    };
  }, [analytics.highPriority, analytics.hotspotCount, analytics.open, analytics.slaBreached, analytics.topWard, region]);

  return (
    <section className="section">
      <AdminNav />
      <div className="mb-6">
        <p className="eyebrow">{region.name} civic command center</p>
        <h1 className="page-title">Admin dashboard</h1>
        {user.role !== "super-admin" && (
          <p className="mt-1 text-sm font-bold text-slate-500">
            {user.role === "senior-officer" ? `Scoped to Zone ${user.zoneNumber}` : "Scoped to complaints assigned to you"}
          </p>
        )}
        <p className="mt-3 max-w-3xl text-slate-700">{briefing}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={analytics.total} icon={Layers3} tone="teal" />
        <StatCard label="Open" value={analytics.open} icon={AlertTriangle} tone="blue" />
        <StatCard label="In progress" value={analytics.inProgress} icon={Clock} tone="amber" />
        <StatCard label="Resolved" value={analytics.resolved} icon={CheckCircle2} tone="teal" />
        <StatCard label="High priority" value={analytics.highPriority} icon={ShieldAlert} tone="rose" />
        <StatCard label="SLA breached" value={analytics.slaBreached} icon={AlertTriangle} tone="rose" />
        <StatCard label="Avg civic impact" value={analytics.avgCivicImpactScore ?? "-"} icon={Gauge} tone="amber" />
        <StatCard label="Hotspots" value={analytics.hotspotCount} icon={Flame} tone="rose" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
        <div className="card p-5">
          <h2 className="mb-4 text-xl font-black">Unresolved hotspots</h2>
          <MapPanel complaints={scoped.filter((item) => item.status !== "Resolved")} regionId={region.regionId} height={420} />
        </div>
        <div className="grid gap-5">
          <div className="card p-5">
            <h2 className="mb-4 text-xl font-black">Complaints by ward</h2>
            <BarList items={analytics.topWardsList} />
          </div>
          <div className="card p-5">
            <h2 className="mb-4 text-xl font-black">Priority breakdown</h2>
            <BarList items={analytics.byPriority} />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 text-xl font-black">Department performance</h2>
          <div className="space-y-3">
            {analytics.departmentPerformance.map((row) => (
              <div key={row.department} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between font-bold">
                  <span>{row.department}</span>
                  <span>{row.resolutionRate}% resolved</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {row.resolved}/{row.total} resolved - avg {row.avgResolutionHours ?? "-"}h
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-xl font-black">Emerging hotspots (7-day trend)</h2>
          {analytics.trends.length ? (
            <div className="space-y-3">
              {analytics.trends.map((row) => (
                <div key={row.area} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="font-bold">{row.area}</span>
                  <span className="text-slate-500">{row.previousCount} to {row.count} (+{row.delta})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No rising areas this week.</p>
          )}
        </div>
      </div>

      {(user.role === "super-admin" || user.role === "senior-officer") && analytics.officerPerformance.length > 0 && (
        <div className="mt-6 card p-5">
          <h2 className="mb-4 text-xl font-black">Officer performance</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {analytics.officerPerformance
              .filter((row) => user.role === "super-admin" || row.zoneNumber === user.zoneNumber)
              .map((row) => (
                <div key={row.email} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-black">{row.name}</p>
                  <p className="text-xs text-slate-500">Zone {row.zoneNumber}</p>
                  <p className="mt-2 text-xs text-slate-600">
                    {row.total} assigned - {row.resolutionRate}% resolved - avg {row.avgResolutionHours ?? "-"}h - {row.escalations} escalated
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-4 text-xl font-black">Recent activity</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {recent.map((complaint) => <ComplaintCard key={complaint.complaintId} complaint={complaint} compact />)}
        </div>
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import { ShieldPlus, Users } from "lucide-react";
import AdminNav from "./AdminNav.jsx";
import { getRegion } from "../../config/regions.js";
import { loadCityGis } from "../../services/geoService.js";
import { getSuperAdminEmails } from "../../services/officerService.js";
import { useAuth } from "../../state/AuthContext.jsx";
import { useData } from "../../state/DataContext.jsx";
import { useToast } from "../../state/ToastContext.jsx";

const emptyForm = { email: "", name: "", roleTier: "junior-officer", zoneNumber: "" };

export default function AdminOfficers() {
  const { user } = useAuth();
  const { officers, analytics, saveOfficer } = useData();
  const { showToast } = useToast();
  const region = getRegion(user?.regionPreference);
  const [zones, setZones] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (region.geoMode !== "polygon") return;
    loadCityGis(region).then((gis) => {
      const numbers = [...new Set(gis.zones.features.map((feature) => feature.properties.zoneNumber))]
        .filter((value) => value != null)
        .sort((a, b) => a - b);
      setZones(numbers);
    });
  }, [region]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.email || !form.zoneNumber) {
      showToast("Email and zone are required.", "error");
      return;
    }
    setBusy(true);
    try {
      await saveOfficer({
        email: form.email,
        name: form.name,
        roleTier: form.roleTier,
        zoneNumber: Number(form.zoneNumber),
        active: true,
      });
      showToast("Officer saved.");
      setForm(emptyForm);
    } catch (error) {
      showToast(error.message || "Could not save officer.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(officer) {
    await saveOfficer({ ...officer, active: officer.active === false });
    showToast(officer.active === false ? "Officer reactivated." : "Officer deactivated.");
  }

  return (
    <section className="section">
      <AdminNav />
      <div className="mb-6">
        <p className="eyebrow">Roster management</p>
        <h1 className="page-title">Manage officers</h1>
        <p className="page-subtitle">
          Super admin{getSuperAdminEmails().length > 1 ? "s" : ""}: {getSuperAdminEmails().join(", ") || "none configured"}.
          Senior and junior officers below sign in with their own email - roles and zone scope are decided here, not in code.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <form className="card space-y-4 p-5" onSubmit={handleSubmit}>
          <h2 className="flex items-center gap-2 text-xl font-black"><ShieldPlus size={20} className="text-civic" /> Add / update officer</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Email</span>
            <input className="field" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="officer@example.com" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Name</span>
            <input className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Officer name" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Role</span>
            <select className="field" value={form.roleTier} onChange={(event) => setForm({ ...form, roleTier: event.target.value })}>
              <option value="senior-officer">Senior / zone officer</option>
              <option value="junior-officer">Junior / field officer</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Zone</span>
            <select className="field" value={form.zoneNumber} onChange={(event) => setForm({ ...form, zoneNumber: event.target.value })}>
              <option value="">Select a zone</option>
              {zones.map((number) => <option key={number} value={number}>{`Zone ${number}`}</option>)}
            </select>
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy}>{busy ? "Saving..." : "Save officer"}</button>
        </form>

        <div className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Users size={20} className="text-civic" /> Roster</h2>
          <div className="space-y-3">
            {officers.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No officers added yet.</p>
            )}
            {officers.map((officer) => {
              const perf = analytics.officerPerformance.find((row) => row.email === officer.email);
              const inactive = officer.active === false;
              return (
                <div key={officer.email} className={`flex items-start gap-3 rounded-lg border p-3 transition ${inactive ? "border-slate-200 bg-slate-50 opacity-60" : "border-slate-200 hover:border-civic/30 hover:bg-teal-50/30"}`}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-teal-50 text-sm font-black text-civic ring-4 ring-teal-100">
                    {(officer.name || officer.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-black">{officer.name || officer.email}</p>
                        <p className="truncate text-xs text-slate-500">{officer.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-bold text-civic">
                          {officer.roleTier === "senior-officer" ? "Senior officer" : "Junior officer"} - Zone {officer.zoneNumber}
                        </span>
                        <button type="button" className="btn-ghost text-xs" onClick={() => toggleActive(officer)}>
                          {inactive ? "Reactivate" : "Deactivate"}
                        </button>
                      </div>
                    </div>
                    {perf && (
                      <p className="mt-2 text-xs text-slate-500">
                        {perf.total} assigned - {perf.resolutionRate}% resolved - avg {perf.avgResolutionHours ?? "-"}h - {perf.escalations} escalated
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

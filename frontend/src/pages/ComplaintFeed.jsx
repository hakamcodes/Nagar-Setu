import { Inbox, Search } from "lucide-react";
import { useMemo, useState } from "react";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";
import { complaintStatuses, issueCategories } from "../config/regions.js";
import { useData } from "../state/DataContext.jsx";
import { useRegion } from "../state/RegionContext.jsx";

export default function ComplaintFeed() {
  const { complaints, loading } = useData();
  const { activeRegion } = useRegion();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");

  const regionComplaints = useMemo(
    () => complaints.filter((item) => !item.regionId || item.regionId === activeRegion),
    [activeRegion, complaints],
  );

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return regionComplaints
      .filter((item) => !status || item.status === status)
      .filter((item) => !category || item.aiCategory === category)
      .filter((item) => !needle || `${item.description} ${item.aiSummary} ${item.zoneName}`.toLowerCase().includes(needle));
  }, [category, query, regionComplaints, status]);

  return (
    <section className="section">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Public feed</p>
          <h1 className="page-title">Live complaints</h1>
          {!loading && <p className="mt-2 text-sm font-semibold text-slate-500">{filtered.length} of {regionComplaints.length} complaints shown</p>}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-[700px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 text-slate-400" size={17} />
            <input className="field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues" />
          </label>
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {complaintStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {issueCategories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="card h-40 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((complaint) => <ComplaintCard key={complaint.complaintId} complaint={complaint} />)}
          {!filtered.length && (
            <div className="card col-span-full grid place-items-center gap-3 p-10 text-center text-slate-500">
              <Inbox size={28} className="text-slate-300" />
              No complaints match these filters yet.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

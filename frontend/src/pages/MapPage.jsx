import { useMemo, useState } from "react";
import MapPanel from "../components/map/MapPanel.jsx";
import { complaintStatuses, getAreaLabel, getRegion, issueCategories, priorities } from "../config/regions.js";
import { useData } from "../state/DataContext.jsx";
import { useRegion } from "../state/RegionContext.jsx";
import { useT } from "../i18n/useT.js";

export default function MapPage() {
  const { complaints } = useData();
  const { activeRegion } = useRegion();
  const t = useT();
  const region = getRegion(activeRegion);
  const areaLabel = getAreaLabel(region.regionId);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [ward, setWard] = useState("");

  const regionComplaints = useMemo(
    () => complaints.filter((item) => !item.regionId || item.regionId === region.regionId),
    [complaints, region.regionId],
  );

  const wardOptions = useMemo(() => {
    const seen = new Map();
    regionComplaints.forEach((item) => {
      if (item.ward?.number) seen.set(item.ward.number, item.ward.name);
    });
    return [...seen.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [regionComplaints]);

  return (
    <section className="section">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">{t.mapEyebrow}</p>
          <h1 className="page-title">{t.mapTitle}</h1>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:w-[820px]">
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">{t.mapAllStatuses}</option>
            {complaintStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{t.mapAllCategories}</option>
            {issueCategories.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">{t.mapAllPriorities}</option>
            {priorities.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="field" value={ward} onChange={(event) => setWard(event.target.value)}>
            <option value="">All {areaLabel.toLowerCase()}s</option>
            {wardOptions.map(([number, name]) => <option key={number} value={number}>{`${areaLabel} ${number} - ${name}`}</option>)}
          </select>
        </div>
      </div>
      <div className="card p-3">
        <MapPanel complaints={regionComplaints} regionId={region.regionId} height={640} filters={{ status, category, priority, ward }} />
      </div>
    </section>
  );
}

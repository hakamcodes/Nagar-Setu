import { ThumbsUp } from "lucide-react";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";
import { readStore } from "../services/prototypeStore.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";

export default function SupportedIssues() {
  const { user } = useAuth();
  const { complaints } = useData();
  const supportedIds = new Set(readStore().votes.filter((vote) => vote.userId === user.uid).map((vote) => vote.complaintId));
  const supported = complaints.filter((item) => supportedIds.has(item.complaintId));

  return (
    <section className="section">
      <p className="eyebrow">Your activity</p>
      <h1 className="page-title">Supported issues</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {supported.map((complaint) => <ComplaintCard key={complaint.complaintId} complaint={complaint} />)}
        {!supported.length && (
          <div className="card col-span-full grid place-items-center gap-3 p-10 text-center text-slate-500">
            <ThumbsUp size={28} className="text-slate-300" />
            You have not supported any issues yet.
          </div>
        )}
      </div>
    </section>
  );
}

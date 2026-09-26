import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Clock, Inbox, MapPin, PenLine } from "lucide-react";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { listDrafts } from "../services/complaintRepository.js";
import { timeAgo } from "../utils/date.js";

function DraftCard({ draft }) {
  return (
    <Link
      to={`/complete-draft/${draft.draftId}`}
      className="card card-hover group block overflow-hidden border-dashed border-amber-300"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Thumbnail */}
        <div className="grid aspect-[16/10] w-full place-items-center overflow-hidden bg-amber-50 text-amber-300 sm:w-44">
          {draft.imageData ? (
            <img
              src={draft.imageData}
              alt="Draft"
              className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-105"
            />
          ) : (
            <Camera size={34} />
          )}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Incomplete badge */}
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              <Clock size={11} />
              Incomplete
            </span>
            <span className="text-xs font-semibold text-slate-500">{timeAgo(draft.createdAt)}</span>
          </div>

          <div>
            <h3 className="line-clamp-2 text-base font-black text-ink transition group-hover:text-civic">
              {draft.description ? draft.description : "Photo saved — tap to add description"}
            </h3>
            {!draft.description && (
              <p className="mt-1 text-sm text-slate-500">
                You captured a photo but haven&apos;t described the issue yet.
              </p>
            )}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-500">
            {(draft.latitude || draft.zoneName) ? (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} className="text-amber-500" />
                {draft.zoneName || (draft.latitude ? "GPS saved" : "No location")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <MapPin size={14} />
                No location — tap to add
              </span>
            )}
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 group-hover:bg-amber-100 transition">
              <PenLine size={13} />
              Complete now
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MyComplaints() {
  const { user } = useAuth();
  const { complaints } = useData();
  const mine = complaints.filter((item) => item.userId === user.uid);

  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    if (user?.uid) {
      setDrafts(listDrafts(user.uid));
    }

    // Refresh drafts when store changes (e.g., after saving a new draft)
    const handleUpdate = () => {
      if (user?.uid) setDrafts(listDrafts(user.uid));
    };
    window.addEventListener("nagar-setu-store-updated", handleUpdate);
    return () => window.removeEventListener("nagar-setu-store-updated", handleUpdate);
  }, [user?.uid]);

  const isEmpty = !mine.length && !drafts.length;

  return (
    <section className="section">
      <p className="eyebrow">Your activity</p>
      <h1 className="page-title">My complaints</h1>

      {/* Drafts section */}
      {drafts.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-amber-700">
            <Clock size={16} />
            Incomplete drafts ({drafts.length})
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {drafts.map((draft) => (
              <DraftCard key={draft.draftId} draft={draft} />
            ))}
          </div>
        </div>
      )}

      {/* Submitted complaints */}
      <div className={drafts.length > 0 ? "mt-8" : "mt-6"}>
        {mine.length > 0 && (
          <h2 className="mb-3 text-base font-bold text-slate-700">
            Submitted complaints ({mine.length})
          </h2>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {mine.map((complaint) => (
            <ComplaintCard key={complaint.complaintId} complaint={complaint} />
          ))}
        </div>
      </div>

      {isEmpty && (
        <div className="card col-span-full mt-6 grid place-items-center gap-3 p-10 text-center text-slate-500">
          <Inbox size={28} className="text-slate-300" />
          No complaints or drafts from this account yet.
        </div>
      )}
    </section>
  );
}

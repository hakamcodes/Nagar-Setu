import { Link } from "react-router-dom";
import { MapPin, MessageSquareWarning, ThumbsUp } from "lucide-react";
import { PriorityBadge, StatusBadge } from "../ui/Badge.jsx";
import { timeAgo } from "../../utils/date.js";

export default function ComplaintCard({ complaint, compact = false }) {
  return (
    <Link to={`/complaints/${complaint.complaintId}`} className="card card-hover group block overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <div className="grid aspect-[16/10] w-full place-items-center overflow-hidden bg-slate-100 text-slate-300 sm:w-44">
          {complaint.imageData ? (
            <img src={complaint.imageData} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <MessageSquareWarning size={34} />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.aiPriority} />
            <span className="text-xs font-semibold text-slate-500">{timeAgo(complaint.createdAt)}</span>
          </div>
          <div>
            <h3 className="line-clamp-2 text-lg font-black text-ink transition group-hover:text-civic">{complaint.aiSummary || complaint.description}</h3>
            {!compact && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{complaint.description}</p>}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-600">
            <span>{complaint.aiCategory}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={15} className="text-civic" /> {complaint.ward ? `Ward ${complaint.ward.number}` : complaint.zoneName || "Unmapped"}</span>
            <span className="inline-flex items-center gap-1"><ThumbsUp size={15} className="text-civic" /> {complaint.supportCount || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

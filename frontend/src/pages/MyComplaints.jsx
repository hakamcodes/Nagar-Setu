import { Inbox } from "lucide-react";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";

export default function MyComplaints() {
  const { user } = useAuth();
  const { complaints } = useData();
  const mine = complaints.filter((item) => item.userId === user.uid);

  return (
    <section className="section">
      <p className="eyebrow">Your activity</p>
      <h1 className="page-title">My complaints</h1>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {mine.map((complaint) => <ComplaintCard key={complaint.complaintId} complaint={complaint} />)}
        {!mine.length && (
          <div className="card col-span-full grid place-items-center gap-3 p-10 text-center text-slate-500">
            <Inbox size={28} className="text-slate-300" />
            No complaints submitted from this account yet.
          </div>
        )}
      </div>
    </section>
  );
}

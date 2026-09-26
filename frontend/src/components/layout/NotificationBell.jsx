import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { timeAgo } from "../../utils/date.js";
import { useData } from "../../state/DataContext.jsx";

export default function NotificationBell() {
  const { notifications, markNotificationsRead, removeNotification } = useData();
  const [open, setOpen] = useState(false);
  const unread = notifications.filter((item) => !item.read).length;

  return (
    <div className="relative">
      <button type="button" className="btn-ghost relative" aria-label="Notifications" onClick={() => setOpen((value) => !value)}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white p-2 shadow-soft">
          <p className="px-2 py-1 text-xs font-bold uppercase tracking-wider text-slate-400">Notifications</p>
          {notifications.length === 0 && <p className="px-2 py-3 text-sm text-slate-500">No notifications yet.</p>}
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {notifications.map((item) => (
              <div key={item.notificationId} className="group relative">
                <Link
                  to={`/complaints/${item.complaintId}`}
                  onClick={() => {
                    setOpen(false);
                    if (!item.read) markNotificationsRead(item.notificationId);
                  }}
                  className={`block rounded-md p-2 pr-7 text-sm ${item.read ? "text-slate-500" : "bg-teal-50 font-semibold text-ink"}`}
                >
                  {item.message}
                  <span className="mt-1 block text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
                </Link>
                <button
                  type="button"
                  aria-label="Delete notification"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeNotification(item.notificationId);
                  }}
                  className="absolute right-1 top-1 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

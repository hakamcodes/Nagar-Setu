import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Bell, X } from "lucide-react";
import { timeAgo } from "../../utils/date.js";
import { useData } from "../../state/DataContext.jsx";
import { useT } from "../../i18n/useT.js";

export default function NotificationBell() {
  const { notifications, markNotificationsRead, removeNotification } = useData();
  const t = useT();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const unread = notifications.filter((item) => !item.read).length;

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className="btn-ghost relative"
        aria-label={`${t.notifTitle}${unread > 0 ? ` (${unread})` : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white shadow-lift animate-fade-up">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">{t.notifTitle}</p>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs font-semibold text-civic hover:underline"
                onClick={() => notifications.filter(n => !n.read).forEach(n => markNotificationsRead(n.notificationId))}
              >
                {t.notifMarkAllRead}
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <p className="px-4 py-5 text-center text-sm text-slate-400">
                🔔 {t.notifEmpty}
              </p>
            ) : (
              notifications.map((item) => (
                <div key={item.notificationId} className="group relative">
                  <Link
                    to={`/complaints/${item.complaintId}`}
                    onClick={() => {
                      setOpen(false);
                      if (!item.read) markNotificationsRead(item.notificationId);
                    }}
                    className={`block px-4 py-3 pr-9 text-sm transition hover:bg-slate-50 ${
                      item.read ? "text-slate-500" : "font-semibold text-ink"
                    }`}
                  >
                    {!item.read && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-civic align-middle" />
                    )}
                    {item.message}
                    <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete notification"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeNotification(item.notificationId);
                    }}
                    className="absolute right-2 top-3 rounded p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

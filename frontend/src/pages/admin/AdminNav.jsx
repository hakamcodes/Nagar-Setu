import { NavLink } from "react-router-dom";
import { useAuth } from "../../state/AuthContext.jsx";

const baseItems = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/complaints", label: "Complaints" },
  { to: "/admin/analytics", label: "Analytics" },
  { to: "/admin/zones", label: "Zones" },
];

export default function AdminNav() {
  const { user } = useAuth();
  const items = user?.role === "super-admin" ? [...baseItems, { to: "/admin/officers", label: "Officers" }] : baseItems;

  return (
    <div className="mb-6 flex gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/admin"}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-md px-3 py-2 text-sm font-bold ${isActive ? "bg-ink text-white" : "text-slate-600 hover:bg-slate-100"}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BarChart3, Bell, LogOut, Map, Menu, Settings, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../state/AuthContext.jsx";
import ToastViewport from "../ui/ToastViewport.jsx";
import NotificationBell from "./NotificationBell.jsx";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/report", label: "Report" },
  { to: "/complaints", label: "Complaints" },
  { to: "/map", label: "Map" },
];

function NavigationLink({ to, label, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end={to === "/"}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-semibold transition duration-150 ${
          isActive ? "bg-civic text-white shadow-card" : "text-slate-700 hover:bg-slate-100 hover:text-ink"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

/** Small pill that toggles between EN and हिं */
function LangToggle({ lang, onToggle, disabled }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={lang === "hi" ? "Switch to English" : "हिंदी में बदलें"}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-ink shadow-sm transition hover:border-civic/60 hover:text-civic"
    >
      <span className="text-sm leading-none">{lang === "hi" ? "🇮🇳" : "🇬🇧"}</span>
      <span>{lang === "hi" ? "हिं" : "EN"}</span>
    </button>
  );
}

export default function AppShell() {
  const { user, isAdmin, logout, updateUiLang } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const lang = user?.uiLang ?? "en";
  function toggleLang() {
    const next = lang === "en" ? "hi" : "en";
    if (updateUiLang) updateUiLang(next);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-paper/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">

          {/* Logo */}
          <NavLink to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-gradient-to-br from-ink to-teal-900 text-sm font-black text-white shadow-card transition group-hover:shadow-glow">
              NS
            </span>
            <span className="hidden sm:block">
              <span className="block text-base font-black tracking-tight leading-tight">Nagar Setu</span>
              <span className="block text-[11px] font-medium text-slate-500 leading-tight">Civic intelligence</span>
            </span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {navItems.map((item) => (
              <NavigationLink key={item.to} {...item} />
            ))}
            {user && <NavigationLink to="/my-complaints" label={lang === "hi" ? "मेरी" : "Mine"} />}
            {isAdmin && <NavigationLink to="/admin" label={lang === "hi" ? "एडमिन" : "Admin"} />}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden items-center gap-2 md:flex">
            {/* Language toggle — always visible when signed in */}
            {user && <LangToggle lang={lang} onToggle={toggleLang} />}

            {user ? (
              <>
                {/* Notification bell — all signed-in users */}
                <NotificationBell />
                <NavLink to="/settings" className="btn-ghost" title="Settings">
                  <Settings size={17} />
                  <span className="hidden lg:inline max-w-[120px] truncate">{user.name}</span>
                </NavLink>
                <button type="button" className="btn-secondary" onClick={logout}>
                  <LogOut size={17} />
                  <span className="hidden lg:inline">{lang === "hi" ? "लॉग आउट" : "Sign out"}</span>
                </button>
              </>
            ) : (
              <>
                <LangToggle lang={lang} onToggle={toggleLang} />
                <NavLink to="/signin" state={{ from: location }} className="btn-primary">
                  <User size={17} />
                  {lang === "hi" ? "साइन इन" : "Sign in"}
                </NavLink>
              </>
            )}
          </div>

          {/* Mobile: notification bell + hamburger */}
          <div className="flex items-center gap-1 md:hidden">
            {user && <NotificationBell />}
            <button
              type="button"
              className="btn-ghost"
              aria-label="Open menu"
              onClick={() => setOpen(true)}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-ink/40 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="ml-auto flex h-full w-[min(86vw,340px)] animate-fade-up flex-col bg-white shadow-soft"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-ink to-teal-900 text-xs font-black text-white">
                  NS
                </span>
                <span className="text-base font-black">Nagar Setu</span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* User chip */}
            {user && (
              <div className="mx-4 mt-4 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-civic text-sm font-black text-white">
                  {user.name?.[0]?.toUpperCase() ?? "U"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{user.name}</p>
                  <p className="truncate text-xs text-slate-500 capitalize">{user.role?.replace(/-/g, " ")}</p>
                </div>
              </div>
            )}

            {/* Nav links */}
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {navItems.map((item) => (
                <NavigationLink key={item.to} {...item} onClick={() => setOpen(false)} />
              ))}
              {user && <NavigationLink to="/my-complaints" label={lang === "hi" ? "मेरी शिकायतें" : "My complaints"} onClick={() => setOpen(false)} />}
              {user && <NavigationLink to="/supported" label={lang === "hi" ? "समर्थित मुद्दे" : "Supported issues"} onClick={() => setOpen(false)} />}
              {isAdmin && <NavigationLink to="/admin" label={lang === "hi" ? "एडमिन डैशबोर्ड" : "Admin dashboard"} onClick={() => setOpen(false)} />}

              <div className="my-2 border-t border-slate-100" />

              {/* Language toggle in drawer */}
              <div className="flex items-center justify-between rounded-md px-3 py-2">
                <span className="text-sm font-semibold text-slate-600">
                  {lang === "hi" ? "भाषा" : "Language"}
                </span>
                <LangToggle lang={lang} onToggle={toggleLang} />
              </div>

              {user && (
                <NavLink
                  to="/settings"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isActive ? "bg-civic text-white" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  <Settings size={16} />
                  {lang === "hi" ? "सेटिंग्स" : "Settings"}
                </NavLink>
              )}
            </nav>

            {/* Drawer footer */}
            <div className="border-t border-slate-100 p-4">
              {user ? (
                <button type="button" className="btn-secondary w-full" onClick={() => { logout(); setOpen(false); }}>
                  <LogOut size={16} />
                  {lang === "hi" ? "लॉग आउट" : "Sign out"}
                </button>
              ) : (
                <NavLink
                  to="/signin"
                  state={{ from: location }}
                  className="btn-primary w-full"
                  onClick={() => setOpen(false)}
                >
                  <User size={16} />
                  {lang === "hi" ? "साइन इन करें" : "Sign in"}
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="leading-relaxed">
            Nagar Setu is piloted in Bhopal with real ward/zone GIS data, and supports future cities by configuration.
          </span>
          <span className="flex flex-wrap items-center gap-3 shrink-0">
            <span className="inline-flex items-center gap-1.5"><Map size={13} className="text-civic" /> Leaflet + OSM</span>
            <span className="inline-flex items-center gap-1.5"><Shield size={13} className="text-civic" /> Role protected</span>
            <span className="inline-flex items-center gap-1.5"><BarChart3 size={13} className="text-civic" /> Analytics ready</span>
          </span>
        </div>
      </footer>
      <ToastViewport />
    </div>
  );
}

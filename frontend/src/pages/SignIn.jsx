import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Mail, Shield, ShieldCheck, UserRound, Users } from "lucide-react";
import { useAuth } from "../state/AuthContext.jsx";
import { useToast } from "../state/ToastContext.jsx";
import { useT } from "../i18n/useT.js";

export default function SignIn() {
  const { user, signInWithGoogle, signInEmail, signUpEmail, signInDemo } = useAuth();
  const t = useT();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const target = location.state?.from?.pathname || "/report";

  if (user) return <Navigate to={target} replace />;

  async function handleEmail(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") await signUpEmail(email, password, name);
      else await signInEmail(email, password);
      navigate(target, { replace: true });
    } catch (error) {
      showToast(error.message || "Could not sign in.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo(role) {
    signInDemo(role);
    navigate(role === "citizen" ? target : "/admin", { replace: true });
  }

  return (
    <section className="section grid min-h-[calc(100vh-8rem)] items-center gap-8 lg:grid-cols-[1fr_0.9fr]">
      <div className="animate-fade-up">
        <p className="eyebrow">{t.signInEyebrow}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-ink sm:text-5xl">{t.signInTitle}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-700">{t.signInBody}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={() => handleDemo("citizen")}>
            <UserRound size={17} /> {t.signInDemoCitizen}
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleDemo("junior-officer")}>
            <Users size={17} /> {t.signInDemoJunior}
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleDemo("senior-officer")}>
            <Shield size={17} /> {t.signInDemoSenior}
          </button>
          <button type="button" className="btn-secondary" onClick={() => handleDemo("super-admin")}>
            <ShieldCheck size={17} /> {t.signInDemoSuper}
          </button>
        </div>
      </div>

      <div className="card p-6 shadow-lift">
        <div className="mb-5 flex rounded-lg bg-slate-100 p-1">
          <button type="button" className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${mode === "signin" ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`} onClick={() => setMode("signin")}>
            {t.signInTab}
          </button>
          <button type="button" className={`flex-1 rounded-md px-3 py-2 text-sm font-bold transition ${mode === "signup" ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink"}`} onClick={() => setMode("signup")}>
            {t.signUpTab}
          </button>
        </div>

        <button type="button" className="btn-primary w-full" onClick={signInWithGoogle}>
          <Mail size={17} /> {t.signInGoogle}
        </button>

        <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          {t.signInEmailLabel}
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="space-y-4" onSubmit={handleEmail}>
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-sm font-bold">{t.signInNameLabel}</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.signInNamePlaceholder} />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{t.signInEmailLabel}</span>
            <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold">{t.signInPasswordLabel}</span>
            <input className="field" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.signInPasswordPlaceholder} />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? t.signInWait : mode === "signup" ? t.signUpSubmit : t.signInSubmit}
          </button>
        </form>
      </div>
    </section>
  );
}

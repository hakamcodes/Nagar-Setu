import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, CheckCircle2, Layers3,
  MapPinned, Radar, ShieldCheck, Sparkles, ThumbsUp,
} from "lucide-react";
import { buildAnalytics } from "../services/analyticsService.js";
import { getRegion } from "../config/regions.js";
import { useAuth } from "../state/AuthContext.jsx";
import { useData } from "../state/DataContext.jsx";
import { useRegion } from "../state/RegionContext.jsx";
import { useT } from "../i18n/useT.js";
import { timeAgo } from "../utils/date.js";
import StatCard from "../components/ui/StatCard.jsx";
import ComplaintCard from "../components/complaints/ComplaintCard.jsx";

export default function Home() {
  const { isAdmin } = useAuth();
  const t = useT();
  const { complaints, officers } = useData();
  const { activeRegion } = useRegion();
  const region = getRegion(activeRegion);

  const regionComplaints = useMemo(
    () => complaints.filter((item) => !item.regionId || item.regionId === region.regionId),
    [complaints, region.regionId],
  );
  const analytics = useMemo(() => buildAnalytics(regionComplaints, officers), [officers, regionComplaints]);
  const latest = regionComplaints.slice(0, 3);

  // Most recent complaint for "last reported" pulse
  const lastComplaint = useMemo(
    () => [...regionComplaints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0],
    [regionComplaints],
  );

  // Unique ward count from actual data
  const wardCount = useMemo(() => {
    const seen = new Set(regionComplaints.map((c) => c.ward?.number).filter(Boolean));
    return seen.size || region.wardCount || "—";
  }, [regionComplaints, region.wardCount]);

  const features = [
    { num: "01", icon: MapPinned, title: t.feat1Title, text: t.feat1Text },
    { num: "02", icon: Sparkles,  title: t.feat2Title, text: t.feat2Text },
    { num: "03", icon: Radar,     title: t.feat3Title, text: t.feat3Text },
    { num: "04", icon: BarChart3, title: t.feat4Title, text: t.feat4Text },
  ];

  const steps = [
    { emoji: t.homeStep1Emoji, title: t.homeStep1Title, text: t.homeStep1Text },
    { emoji: t.homeStep2Emoji, title: t.homeStep2Title, text: t.homeStep2Text },
    { emoji: t.homeStep3Emoji, title: t.homeStep3Title, text: t.homeStep3Text },
  ];

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Improved gradient — two blobs for depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[42rem] bg-[radial-gradient(55%_55%_at_60%_0%,rgba(15,118,110,0.22),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-32 top-20 -z-10 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(15,118,110,0.09),transparent_70%)]"
        />

        <div className="section grid min-h-[calc(100vh-4rem)] items-center gap-10 py-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-fade-up">
            {/* Badge */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-bold text-teal-800 shadow-sm">
                <ShieldCheck size={16} />
                {t.homeBadge} {region.name}
              </span>
            </div>

            {/* ① Value-driven tagline above the hero name */}
            <p className="mb-3 text-base font-bold tracking-wide text-civic sm:text-lg">
              {t.homeTagline}
            </p>

            {/* Hero h1 */}
            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-ink sm:text-6xl lg:text-7xl">
              {t.homeHero} <span className="text-civic">{t.homeHeroAccent}</span>
            </h1>

            <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-slate-700">
              {t.homeSubtitle}
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="btn-primary px-5 py-3 text-base">
                {t.homeCtaReport} <ArrowRight size={18} />
              </Link>
              <Link to="/complaints" className="btn-secondary px-5 py-3 text-base">
                {t.homeCtaComplaints}
              </Link>
              {isAdmin && (
                <Link to="/admin" className="btn-secondary px-5 py-3 text-base">
                  {t.homeCtaAdmin}
                </Link>
              )}
            </div>

            {/* ② Trust bar — live numbers just under CTAs */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <span className="text-base font-black text-ink">{analytics.total}</span>
                {t.homeTrustReported}
              </span>
              <span className="h-4 w-px bg-slate-200" />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <span className="text-base font-black text-civic">{analytics.resolved}</span>
                {t.homeTrustResolved}
              </span>
              <span className="h-4 w-px bg-slate-200" />
              <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <span className="text-base font-black text-ink">{wardCount}</span>
                {t.homeTrustWards}
              </span>
            </div>
          </div>

          {/* Live preview card */}
          <div className="card overflow-hidden shadow-lift">
            <div className="bg-gradient-to-br from-ink to-teal-950 p-5 text-white">
              <div className="flex items-center justify-between">
                {/* ③ Live pulse indicator */}
                <span className="flex items-center gap-2 text-sm font-bold text-teal-100">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                  </span>
                  {t.homeLivePulse}
                  {lastComplaint && (
                    <span className="font-normal text-teal-300">
                      · {t.homeLastReported} {timeAgo(lastComplaint.createdAt)}
                    </span>
                  )}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold">{region.name}</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-3xl font-black">{analytics.unresolved}</p>
                  <p className="text-sm text-slate-200">{t.homeUnresolved}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <p className="text-3xl font-black">{analytics.resolved}</p>
                  <p className="text-sm text-slate-200">{t.homeResolved}</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              {latest.map((complaint) => (
                <ComplaintCard key={complaint.complaintId} complaint={complaint} compact />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats row */}
      <section className="section grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t.statTotal}      value={analytics.total}      icon={Layers3}      tone="teal" />
        <StatCard label={t.statOpen}       value={analytics.open}       icon={Radar}        tone="blue" />
        <StatCard label={t.statInProgress} value={analytics.inProgress} icon={ThumbsUp}     tone="amber" />
        <StatCard label={t.statResolved}   value={analytics.resolved}   icon={CheckCircle2} tone="teal" />
      </section>

      {/* ── ① How it works — 3-step flow ─────────────────────────────────── */}
      <section className="section">
        <div className="mb-10 text-center">
          <p className="eyebrow">{t.homeHowEyebrow}</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">{t.homeHowTitle}</h2>
        </div>

        <div className="relative grid gap-6 sm:grid-cols-3">
          {/* Connector line between steps — desktop only */}
          <div
            aria-hidden="true"
            className="absolute left-[16.67%] right-[16.67%] top-9 hidden h-px bg-gradient-to-r from-teal-200 via-civic/30 to-teal-200 sm:block"
          />

          {steps.map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              {/* Step circle */}
              <div className="relative z-10 mb-5 grid h-20 w-20 place-items-center rounded-full border-4 border-white bg-gradient-to-br from-teal-50 to-white shadow-lift ring-4 ring-teal-100">
                <span className="text-3xl leading-none">{step.emoji}</span>
              </div>
              {/* Step number */}
              <span className="mb-2 text-xs font-black uppercase tracking-widest text-civic opacity-60">
                Step 0{i + 1}
              </span>
              <h3 className="text-lg font-black text-ink">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features section ──────────────────────────────────────────────── */}
      <section className="section">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow">{t.homeSectionEyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-ink">{t.homeSectionTitle}</h2>
          </div>
          <p className="text-base leading-7 text-slate-700">{t.homeSectionBody}</p>
        </div>

        {/* ⑥ Numbered feature cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div key={feature.title} className="card card-hover p-5">
              {/* Number + icon row */}
              <div className="flex items-start justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-50 text-civic ring-4 ring-teal-100">
                  <feature.icon size={22} />
                </span>
                <span className="text-2xl font-black text-slate-100 select-none">{feature.num}</span>
              </div>
              <h3 className="mt-4 text-lg font-black">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

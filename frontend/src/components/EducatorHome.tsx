"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useMTSSTiers, useAnnouncements } from "@/lib/hooks";
import AnnouncementComposer from "@/components/AnnouncementComposer";
import AnnouncementFeed from "@/components/AnnouncementFeed";
import ActivityFeed from "@/components/ActivityFeed";
import {
  gsap,
  useScrollReveal,
  useStaggerReveal,
  useCountUp,
  useProgressFill,
} from "@/lib/gsap";

function formatSkillName(skill: string): string {
  return skill
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function findWeakestSkill(skillTiers: Record<string, string>): { name: string; tier: string } | null {
  const entries = Object.entries(skillTiers);
  const tier3 = entries.find(([, t]) => t === "tier_3");
  if (tier3) return { name: tier3[0], tier: tier3[1] };
  const tier2 = entries.find(([, t]) => t === "tier_2");
  if (tier2) return { name: tier2[0], tier: tier2[1] };
  return null;
}

function tierBadgeClasses(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    case "tier_2":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    case "tier_3":
      return "bg-red-500/10 text-red-400 border border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "Tier 1";
    case "tier_2":
      return "Tier 2";
    case "tier_3":
      return "Tier 3";
    default:
      return tier;
  }
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/70 p-5 animate-pulse">
      <div className="h-9 w-9 bg-zinc-800 rounded-xl mb-3" />
      <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
      <div className="h-8 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

/** Circular progress ring for class average */
function ClassAvgRing({
  avg,
  size = 100,
}: {
  avg: number;
  size?: number;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, avg));

  const strokeColor =
    avg >= 70 ? "#34d399" : avg >= 40 ? "#fbbf24" : "#f87171";

  useEffect(() => {
    if (!ringRef.current) return;
    gsap.set(ringRef.current, { strokeDashoffset: circumference });
    const tween = gsap.to(ringRef.current, {
      strokeDashoffset: circumference - (pct / 100) * circumference,
      duration: 1.5,
      delay: 0.6,
      ease: "power3.out",
    });
    return () => { tween.kill(); };
  }, [pct, circumference]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(63,63,70,0.4)"
          strokeWidth="5"
        />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{avg.toFixed(0)}</span>
        <span className="text-[9px] uppercase tracking-widest text-zinc-500">Class Avg</span>
      </div>
    </div>
  );
}

export default function EducatorHome() {
  const { user } = useAuth();
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: students, isLoading: studentsLoading } = useMTSSTiers();
  const { data: announcements } = useAnnouncements();

  const isLoading = !user || overviewLoading;

  // GSAP refs
  const heroRef = useRef<HTMLDivElement>(null);
  const studentCountRef = useCountUp(
    overview ? Object.values(overview.tier_counts).reduce((a, b) => a + b, 0) : 0,
    { enabled: !isLoading, delay: 0.6 },
  );
  const statsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.1, y: 20 });
  const distributionRef = useScrollReveal<HTMLDivElement>({ y: 30 });
  const announcementsRef = useScrollReveal<HTMLDivElement>({ y: 30, delay: 0.1 });
  const attentionRef = useScrollReveal<HTMLDivElement>({ y: 30 });
  const activityRef = useScrollReveal<HTMLDivElement>({ y: 30 });
  const actionsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.06, y: 24 });

  const tier1BarRef = useProgressFill<HTMLDivElement>(0, { delay: 0.4 });
  const tier2BarRef = useProgressFill<HTMLDivElement>(0, { delay: 0.5 });
  const tier3BarRef = useProgressFill<HTMLDivElement>(0, { delay: 0.6 });

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current || isLoading) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-greeting", { opacity: 0, y: 30, duration: 0.7, ease: "power3.out" });
      gsap.from(".hero-name", { opacity: 0, y: 40, duration: 0.8, delay: 0.15, ease: "power3.out" });
      gsap.from(".hero-subtitle", { opacity: 0, y: 20, duration: 0.6, delay: 0.35, ease: "power3.out" });
      gsap.from(".hero-ring", { opacity: 0, scale: 0.5, duration: 0.8, delay: 0.3, ease: "back.out(1.7)" });
      gsap.from(".hero-stat-block", { opacity: 0, x: 20, duration: 0.6, delay: 0.5, ease: "power3.out" });
    }, heroRef);
    return () => ctx.revert();
  }, [isLoading]);

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-zinc-500 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  const tierCounts = overview?.tier_counts ?? {};
  const studentsByTier = overview?.students_by_tier ?? {};
  const tier1Count = tierCounts["tier_1"] ?? 0;
  const tier2Count = tierCounts["tier_2"] ?? 0;
  const tier3Count = tierCounts["tier_3"] ?? 0;
  const totalStudents = tier1Count + tier2Count + tier3Count;

  const allStudents = students ?? [];
  const classAvg =
    allStudents.length > 0
      ? allStudents.reduce((sum, s) => sum + s.avg_score, 0) / allStudents.length
      : 0;

  const needsAttention = allStudents.filter(
    (s) => s.overall_tier === "tier_2" || s.overall_tier === "tier_3"
  );

  // Compute bar widths for animated progress fills
  const tier1Pct = totalStudents > 0 ? (tier1Count / totalStudents) * 100 : 0;
  const tier2Pct = totalStudents > 0 ? (tier2Count / totalStudents) * 100 : 0;
  const tier3Pct = totalStudents > 0 ? (tier3Count / totalStudents) * 100 : 0;

  // Update bar refs when data loads
  useEffect(() => {
    if (tier1BarRef.current && totalStudents > 0) {
      gsap.to(tier1BarRef.current, { width: `${tier1Pct}%`, duration: 1, delay: 0.4, ease: "power2.out" });
    }
    if (tier2BarRef.current && totalStudents > 0) {
      gsap.to(tier2BarRef.current, { width: `${tier2Pct}%`, duration: 1, delay: 0.5, ease: "power2.out" });
    }
    if (tier3BarRef.current && totalStudents > 0) {
      gsap.to(tier3BarRef.current, { width: `${tier3Pct}%`, duration: 1, delay: 0.6, ease: "power2.out" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalStudents, tier1Pct, tier2Pct, tier3Pct]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div ref={heroRef} className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10">
        {/* Background decorations */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/[0.08] blur-3xl" aria-hidden />
        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-blue-500/[0.06] blur-3xl" aria-hidden />
        <div className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-fuchsia-500/[0.04] blur-3xl" aria-hidden />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text */}
          <div className="min-w-0">
            <p className="hero-greeting text-sm font-medium uppercase tracking-widest text-zinc-500">
              {getGreeting()}
            </p>
            <h1 className="hero-name mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {user?.name || user?.username}
              </span>
            </h1>
            <p className="hero-subtitle mt-2 text-sm text-zinc-400 max-w-md">
              Monitor your class, track student progress, and provide targeted support.
            </p>

            {/* Inline student count */}
            {!overviewLoading && totalStudents > 0 && (
              <div className="hero-stat-block mt-5 flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/[0.08] px-4 py-2">
                  <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <span ref={studentCountRef} className="text-sm font-bold text-white">{totalStudents}</span>
                  <span className="text-xs text-zinc-500">students</span>
                </div>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 shadow-lg shadow-violet-900/20 transition-all hover:bg-white/95 hover:shadow-violet-900/30 hover:scale-[1.02] active:scale-[0.98]"
                >
                  View Dashboard
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
              </div>
            )}
          </div>

          {/* Right — Class Avg Ring */}
          {!overviewLoading && totalStudents > 0 && (
            <div className="hero-ring shrink-0 self-center sm:self-auto">
              <ClassAvgRing avg={classAvg} size={120} />
            </div>
          )}
        </div>
      </div>

      {/* ── Alert Banner ── */}
      {!studentsLoading && tier3Count > 0 && (
        <div className="mb-8 relative overflow-hidden rounded-2xl border border-red-500/30 p-4" style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 100%)" }}>
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-red-500/10 blur-2xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-500/20 text-red-400 mt-0.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <p className="text-red-300 font-semibold">
                  {tier3Count} student{tier3Count > 1 ? "s" : ""} need intensive support
                </p>
                <p className="text-red-400/70 text-sm mt-0.5">
                  {(studentsByTier["tier_3"] ?? []).join(", ")}
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="text-red-300 hover:text-red-200 text-sm whitespace-nowrap ml-4 font-medium"
            >
              View details →
            </Link>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      {(overviewLoading || totalStudents > 0) && (
        <div ref={statsRef} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
          {overviewLoading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              {/* Total Students */}
              <div className="group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-zinc-900/70 p-5 transition-all hover:border-blue-500/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]">
                <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-blue-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mb-3">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total Students</p>
                <p className="text-3xl font-bold tabular-nums text-white mt-1">{totalStudents}</p>
              </div>

              {/* On Track */}
              <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900/70 p-5 transition-all hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(34,197,94,0.15)]">
                <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-emerald-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 mb-3">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">On Track</p>
                <p className="text-3xl font-bold tabular-nums text-emerald-400 mt-1">{tier1Count}</p>
              </div>

              {/* Needs Support */}
              <div className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]">
                <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-amber-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Needs Support</p>
                <p className="text-3xl font-bold tabular-nums text-amber-400 mt-1">{tier2Count}</p>
              </div>

              {/* Intensive */}
              <div className="group relative overflow-hidden rounded-2xl border border-red-500/20 bg-zinc-900/70 p-5 transition-all hover:border-red-500/40 hover:shadow-[0_0_24px_rgba(239,68,68,0.15)]">
                <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-red-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-50" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 text-red-400 mb-3">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Intensive</p>
                <p className="text-3xl font-bold tabular-nums text-red-400 mt-1">{tier3Count}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Class Distribution ── */}
      {(overviewLoading || totalStudents > 0) && (
        <div ref={distributionRef} className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Class Distribution</p>
              <p className="text-xs text-zinc-500">{totalStudents} students across 3 tiers</p>
            </div>
          </div>
          {overviewLoading ? (
            <div className="h-6 rounded-full bg-zinc-800 animate-pulse" />
          ) : (
            <>
              <div className="h-10 rounded-2xl overflow-hidden flex bg-zinc-800/60">
                {tier1Count > 0 && (
                  <div
                    ref={tier1BarRef}
                    className="bg-gradient-to-r from-emerald-600 to-emerald-400 flex items-center justify-center transition-all"
                    style={{ width: 0 }}
                  >
                    {tier1Pct >= 12 && (
                      <span className="text-xs font-bold text-white drop-shadow-sm">{Math.round(tier1Pct)}%</span>
                    )}
                  </div>
                )}
                {tier2Count > 0 && (
                  <div
                    ref={tier2BarRef}
                    className="bg-gradient-to-r from-amber-600 to-amber-400 flex items-center justify-center transition-all"
                    style={{ width: 0 }}
                  >
                    {tier2Pct >= 12 && (
                      <span className="text-xs font-bold text-white drop-shadow-sm">{Math.round(tier2Pct)}%</span>
                    )}
                  </div>
                )}
                {tier3Count > 0 && (
                  <div
                    ref={tier3BarRef}
                    className="bg-gradient-to-r from-red-600 to-red-400 flex items-center justify-center transition-all"
                    style={{ width: 0 }}
                  >
                    {tier3Pct >= 12 && (
                      <span className="text-xs font-bold text-white drop-shadow-sm">{Math.round(tier3Pct)}%</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between mt-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-emerald-400 font-medium">Tier 1 — {tier1Count}</span>
                  <span className="text-zinc-600">({Math.round(tier1Pct)}%)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
                  <span className="text-amber-400 font-medium">Tier 2 — {tier2Count}</span>
                  <span className="text-zinc-600">({Math.round(tier2Pct)}%)</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 inline-block" />
                  <span className="text-red-400 font-medium">Tier 3 — {tier3Count}</span>
                  <span className="text-zinc-600">({Math.round(tier3Pct)}%)</span>
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Announcements Section ── */}
      <div ref={announcementsRef} className="grid gap-4 grid-cols-1 md:grid-cols-2 mb-8">
        <AnnouncementComposer />
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
              </svg>
              <h2 className="text-sm font-semibold text-white">Recent Announcements</h2>
            </div>
            {(announcements?.length ?? 0) > 3 && (
              <span className="text-xs text-zinc-500">{announcements!.length} total</span>
            )}
          </div>
          <AnnouncementFeed
            announcements={announcements ?? []}
            canDelete
            limit={3}
          />
        </div>
      </div>

      {/* ── Students Needing Attention ── */}
      {(studentsLoading || allStudents.length > 0) && (
        <div ref={attentionRef} className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 overflow-hidden mb-8">
          <div className="p-5 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
              <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Students Needing Attention</h2>
              <p className="text-xs text-zinc-500">{needsAttention.length} student{needsAttention.length !== 1 ? "s" : ""} below Tier 1</p>
            </div>
          </div>
          {studentsLoading ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Student</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Tier</th>
                  <th className="hidden px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 text-right sm:table-cell">Avg Score</th>
                  <th className="hidden px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 sm:table-cell">Weakest Skill</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="h-8 w-8 bg-zinc-800 rounded-full animate-pulse" /><div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" /></div></td>
                    <td className="px-5 py-3.5"><div className="h-5 w-12 bg-zinc-800 rounded-full animate-pulse" /></td>
                    <td className="hidden px-5 py-3.5 text-right sm:table-cell"><div className="h-4 w-10 bg-zinc-800 rounded animate-pulse ml-auto" /></td>
                    <td className="hidden px-5 py-3.5 sm:table-cell"><div className="h-5 w-20 bg-zinc-800 rounded-full animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : needsAttention.length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 mb-3">
                <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-emerald-400 font-semibold">All students are on track!</p>
              <p className="text-xs text-zinc-500 mt-1">No students currently need additional support.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Student</th>
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">Tier</th>
                  <th className="hidden px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 text-right sm:table-cell">Avg Score</th>
                  <th className="hidden px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 sm:table-cell">Weakest Skill</th>
                </tr>
              </thead>
              <tbody>
                {needsAttention.map((student) => {
                  const weakest = findWeakestSkill(student.skill_tiers ?? {});
                  const displayName = student.name || student.username;
                  const initials = displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
                  return (
                    <tr
                      key={student.user_id}
                      className="border-b border-white/[0.04] transition-all duration-200 hover:bg-violet-500/[0.05] cursor-pointer group"
                    >
                      <td className="px-5 py-3.5">
                        <Link href={`/dashboard/students/${student.user_id}`} className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
                            {initials}
                          </div>
                          <span className="font-medium text-zinc-200 group-hover:text-white transition-colors">{displayName}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadgeClasses(student.overall_tier)}`}
                        >
                          {tierLabel(student.overall_tier)}
                        </span>
                      </td>
                      <td className="hidden px-5 py-3.5 text-right font-mono text-zinc-200 sm:table-cell">
                        {student.avg_score.toFixed(1)}
                      </td>
                      <td className="hidden px-5 py-3.5 sm:table-cell">
                        {weakest ? (
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadgeClasses(weakest.tier)}`}
                          >
                            {formatSkillName(weakest.name)}
                          </span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Recent Activity Feed ── */}
      <div ref={activityRef} className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
            <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
            <p className="text-xs text-zinc-500">Latest student actions</p>
          </div>
        </div>
        <ActivityFeed />
      </div>

      {/* ── Quick Actions ── */}
      <div ref={actionsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 sm:gap-4 mb-8">
        <Link href="/dashboard" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-blue-500/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.15)] hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Dashboard</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Full analytics</p>
          </div>
        </Link>

        <Link href="/leaderboard" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.15)] hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-violet-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 01-2.27.79 6.04 6.04 0 01-2.27-.79" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Leaderboard</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Class rankings</p>
          </div>
        </Link>

        <Link href="/dashboard/students" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(34,197,94,0.15)] hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-emerald-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Roster</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Manage students</p>
          </div>
        </Link>

        <Link href="/dashboard/messages" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-cyan-500/40 hover:shadow-[0_0_24px_rgba(6,182,212,0.15)] hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-cyan-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400 mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">Messages</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Chat with students</p>
          </div>
        </Link>

        <Link href="/dashboard/mtss" className="group">
          <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-fuchsia-500/40 hover:shadow-[0_0_24px_rgba(217,70,239,0.15)] hover:scale-[1.02] active:scale-[0.98]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-fuchsia-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400 mb-3">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-white">MTSS</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Tiered support</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

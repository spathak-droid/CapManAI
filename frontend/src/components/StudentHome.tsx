"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BadgeInfo } from "@/lib/types";
import { HomeSkeleton } from "@/components/skeletons/HomeSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonProgress, useStreak, useLeaderboard, useMyBadges, useMySkills, useAnnouncements } from "@/lib/hooks";
import AnnouncementFeed from "@/components/AnnouncementFeed";
import BadgeIcon from "@/components/BadgeIcon";
import {
  gsap,
  useScrollReveal,
  useStaggerReveal,
  useCountUp,
  useProgressFill,
} from "@/lib/gsap";

const LEVEL_THRESHOLDS: [number, number][] = [
  [10, 16000],
  [9, 12000],
  [8, 9000],
  [7, 6500],
  [6, 4500],
  [5, 3000],
  [4, 2000],
  [3, 1200],
  [2, 500],
  [1, 0],
];

function getXpProgress(
  xpTotal: number,
  level: number
): { currentThreshold: number; nextThreshold: number; progressPct: number } {
  const currentEntry = LEVEL_THRESHOLDS.find(([lvl]) => lvl === level);
  const nextEntry = LEVEL_THRESHOLDS.find(([lvl]) => lvl === level + 1);
  const currentThreshold = currentEntry?.[1] ?? 0;
  const nextThreshold = nextEntry?.[1] ?? currentThreshold;
  if (nextThreshold <= currentThreshold) {
    return { currentThreshold, nextThreshold, progressPct: 100 };
  }
  const progressPct = Math.min(
    100,
    Math.max(0, ((xpTotal - currentThreshold) / (nextThreshold - currentThreshold)) * 100)
  );
  return { currentThreshold, nextThreshold, progressPct };
}

const SKILLS = [
  { id: "price_action", label: "Price Action" },
  { id: "options_chain", label: "Options Chain" },
  { id: "strike_select", label: "Strike Selection" },
  { id: "risk_mgmt", label: "Risk Management" },
  { id: "position_size", label: "Position Sizing" },
  { id: "regime_id", label: "Regime ID" },
  { id: "vol_assess", label: "Volatility Assessment" },
  { id: "trade_mgmt", label: "Trade Management" },
];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function SkillBar({ skill, score, index }: { skill: { id: string; label: string }; score: number; index: number }) {
  const pct = Math.round(score);
  const barRef = useProgressFill<HTMLDivElement>(pct, { duration: 0.8, delay: 0.1 * index });

  const gradient =
    pct >= 70
      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
      : pct >= 40
        ? "bg-gradient-to-r from-amber-500 to-yellow-400"
        : "bg-gradient-to-r from-red-500 to-rose-400";

  return (
    <div className="group flex items-center gap-3">
      <span className="text-xs sm:text-sm text-zinc-400 w-24 sm:w-40 group-hover:text-zinc-200 transition-colors shrink-0">
        {skill.label}
      </span>
      <div className="flex-1 h-2 rounded-full bg-zinc-800/80 overflow-hidden">
        <div ref={barRef} className={`h-full rounded-full ${gradient}`} />
      </div>
      <span className="text-xs font-mono text-zinc-500 w-10 text-right tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

/** SVG circular progress ring */
function LevelRing({
  percent,
  level,
  size = 120,
}: {
  percent: number;
  level: number;
  size?: number;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const r = (size - 12) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    if (!ringRef.current) return;
    gsap.set(ringRef.current, { strokeDashoffset: circumference });
    const tween = gsap.to(ringRef.current, {
      strokeDashoffset: circumference - (percent / 100) * circumference,
      duration: 1.5,
      delay: 0.5,
      ease: "power3.out",
    });
    return () => { tween.kill(); };
  }, [percent, circumference]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(63,63,70,0.5)"
          strokeWidth="6"
        />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#levelGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
        <defs>
          <linearGradient id="levelGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{level}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">Level</span>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  level: "Level",
  streak: "Streak",
  mastery: "Mastery",
  milestone: "Milestone",
};

const CATEGORY_ORDER: Array<BadgeInfo["category"]> = ["milestone", "level", "streak", "mastery"];

function BadgeShowcase({ badges }: { badges: BadgeInfo[] }) {
  const [tooltip, setTooltip] = useState<{ name: string; description: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort: earned first, then by category order
  const sorted = [...badges].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  });

  // Group by category
  const groups = CATEGORY_ORDER.reduce<Record<string, BadgeInfo[]>>((acc, cat) => {
    const items = sorted.filter((b) => b.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // Limit to 12 visible badges
  const allBadges = sorted.slice(0, 12);

  // GSAP scale-in on mount
  useEffect(() => {
    if (!containerRef.current) return;
    const items = containerRef.current.querySelectorAll(".badge-item");
    const ctx = gsap.context(() => {
      gsap.from(items, {
        scale: 0.5,
        opacity: 0,
        duration: 0.4,
        stagger: 0.06,
        ease: "back.out(1.7)",
        delay: 0.2,
      });
    }, containerRef);
    return () => ctx.revert();
  }, [badges]);

  // Check if all badges fit within categories for grouped display
  const totalVisible = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
  const useGrouped = totalVisible <= 12;

  if (useGrouped) {
    return (
      <div ref={containerRef} className="space-y-4">
        {CATEGORY_ORDER.map((cat) => {
          const group = groups[cat];
          if (!group) return null;
          return (
            <div key={cat}>
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600 mb-2">
                {CATEGORY_LABELS[cat]}
              </p>
              <div className="flex flex-wrap gap-3">
                {group.map((badge) => (
                  <div
                    key={badge.key}
                    className="badge-item relative cursor-pointer transition-transform hover:scale-110"
                    onMouseEnter={() => setTooltip({ name: badge.name, description: badge.description })}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <BadgeIcon
                      badgeKey={badge.key}
                      category={badge.category}
                      earned={badge.earned}
                      size={42}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {tooltip && (
          <div className="mt-2 rounded-lg border border-white/[0.08] bg-zinc-800/90 px-3 py-2 text-center backdrop-blur-sm">
            <p className="text-xs font-semibold text-white">{tooltip.name}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{tooltip.description}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <div className="flex flex-wrap gap-3">
        {allBadges.map((badge) => (
          <div
            key={badge.key}
            className="badge-item relative cursor-pointer transition-transform hover:scale-110"
            onMouseEnter={() => setTooltip({ name: badge.name, description: badge.description })}
            onMouseLeave={() => setTooltip(null)}
          >
            <BadgeIcon
              badgeKey={badge.key}
              category={badge.category}
              earned={badge.earned}
              size={42}
            />
          </div>
        ))}
      </div>
      {tooltip && (
        <div className="mt-2 rounded-lg border border-white/[0.08] bg-zinc-800/90 px-3 py-2 text-center backdrop-blur-sm">
          <p className="text-xs font-semibold text-white">{tooltip.name}</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">{tooltip.description}</p>
        </div>
      )}
    </div>
  );
}

export default function StudentHome() {
  const { user } = useAuth();
  const { data: progress, isLoading: progressLoading } = useLessonProgress();
  const { data: streak, isLoading: streakLoading } = useStreak();
  const { data: leaderboard, isLoading: leaderboardLoading } = useLeaderboard();
  const { data: badgesData } = useMyBadges();
  const { data: skillsData } = useMySkills();
  const { data: announcements } = useAnnouncements();

  const isLoading = !user || progressLoading || streakLoading || leaderboardLoading;

  const xpTotal = user?.xp_total ?? 0;
  const level = user?.level ?? 1;
  const username = user?.name || user?.username || "Trader";
  const { nextThreshold, progressPct } = getXpProgress(xpTotal, level);
  const currentStreak = streak?.current_streak ?? 0;
  const userRank = leaderboard?.find((entry) => entry.user_id === user?.id)?.rank;

  // GSAP refs
  const heroRef = useRef<HTMLDivElement>(null);
  const xpCountRef = useCountUp(xpTotal, { enabled: !isLoading, delay: 0.6 });
  const xpBarRef = useProgressFill<HTMLDivElement>(isLoading ? 0 : progressPct, { delay: 0.8 });
  const statsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.1, y: 20 });
  const continueRef = useScrollReveal<HTMLDivElement>({ y: 30 });
  const actionsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.06, y: 24 });
  const skillRef = useScrollReveal<HTMLDivElement>({ y: 30 });
  const badgeRef = useScrollReveal<HTMLDivElement>({ y: 20 });

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current || isLoading) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-greeting", { opacity: 0, y: 30, duration: 0.7, ease: "power3.out" });
      gsap.from(".hero-username", { opacity: 0, y: 40, duration: 0.8, delay: 0.15, ease: "power3.out" });
      gsap.from(".hero-subtitle", { opacity: 0, y: 20, duration: 0.6, delay: 0.35, ease: "power3.out" });
      gsap.from(".hero-ring", { opacity: 0, scale: 0.5, duration: 0.8, delay: 0.3, ease: "back.out(1.7)" });
      gsap.from(".hero-xp-block", { opacity: 0, x: 20, duration: 0.6, delay: 0.5, ease: "power3.out" });
    }, heroRef);
    return () => ctx.revert();
  }, [isLoading]);

  if (isLoading) {
    return <HomeSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div ref={heroRef} className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10">
        {/* Background decoration */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/[0.07] blur-3xl" aria-hidden />
        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-blue-500/[0.05] blur-3xl" aria-hidden />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text */}
          <div className="min-w-0">
            <p className="hero-greeting text-sm font-medium uppercase tracking-widest text-zinc-500">
              {getGreeting()}
            </p>
            <h1 className="hero-username mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                {username}
              </span>
            </h1>
            <p className="hero-subtitle mt-2 text-sm text-zinc-500 max-w-md">
              Keep pushing your limits. Every scenario brings you closer to mastery.
            </p>

            {/* XP bar inline */}
            <div className="hero-xp-block mt-5 max-w-sm">
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-1.5">
                <span>
                  <span ref={xpCountRef} className="font-mono text-zinc-300">{xpTotal.toLocaleString()}</span> XP
                </span>
                <span className="font-mono">{nextThreshold.toLocaleString()} XP</span>
              </div>
              <div className="h-2.5 rounded-full bg-zinc-800/80 overflow-hidden">
                <div
                  ref={xpBarRef}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500"
                />
              </div>
            </div>
          </div>

          {/* Right — Level Ring */}
          <div className="hero-ring shrink-0 self-center sm:self-auto">
            <LevelRing percent={progressPct} level={level} size={130} />
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div ref={statsRef} className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
        {/* Streak */}
        <div className="group relative overflow-hidden rounded-2xl border border-orange-500/20 bg-zinc-900/70 p-5 transition-all hover:border-orange-500/40 hover:shadow-[0_0_24px_rgba(249,115,22,0.1)]">
          <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-orange-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 mb-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Streak</p>
          <p className="text-2xl font-bold tabular-nums text-white mt-0.5">
            {currentStreak}
            <span className="text-sm font-normal text-zinc-500 ml-0.5">days</span>
          </p>
        </div>

        {/* Rank */}
        <div className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.1)]">
          <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-amber-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516" /></svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Rank</p>
          <p className="text-2xl font-bold tabular-nums text-white mt-0.5">
            {userRank != null ? `#${userRank}` : "—"}
          </p>
        </div>

        {/* Lessons */}
        <div className="group relative overflow-hidden rounded-2xl border border-violet-500/20 bg-zinc-900/70 p-5 transition-all hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.1)]">
          <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-violet-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 mb-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Progress</p>
          <p className="text-2xl font-bold tabular-nums text-white mt-0.5">
            {(progress?.program_completion_percent ?? 0).toFixed(0)}
            <span className="text-sm font-normal text-zinc-500 ml-0.5">%</span>
          </p>
        </div>

        {/* Badges */}
        <div className="group relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-zinc-900/70 p-5 transition-all hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(34,197,94,0.1)]">
          <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-emerald-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 mb-3">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Badges</p>
          <p className="text-2xl font-bold tabular-nums text-white mt-0.5">{badgesData?.total_earned ?? 0}</p>
        </div>
      </div>

      {/* ── Announcements ── */}
      {announcements && announcements.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <svg className="h-5 w-5 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
            </svg>
            <h2 className="text-base font-semibold text-white">Announcements</h2>
          </div>
          <AnnouncementFeed announcements={announcements} limit={3} />
        </div>
      )}

      {/* ── Two-Column: Continue Training + Quick Actions ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-5 mb-8">
        {/* Continue Training — spans 3 cols */}
        <div
          ref={continueRef}
          className="relative overflow-hidden rounded-2xl lg:col-span-3 p-6 sm:p-8"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.9) 0%, rgba(109,40,217,0.85) 40%, rgba(88,28,135,0.9) 100%)",
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,255,255,0.1),transparent)]" aria-hidden />
          <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl" aria-hidden />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <h2 className="text-lg font-semibold text-white">{(progress?.program_completion_percent ?? 0) > 0 ? "Continue Training" : "Get Started"}</h2>
            </div>
            {progress?.next_module_id && progress?.next_chunk_id ? (
              <>
                <p className="text-violet-200/80 text-sm mb-4">
                  {(progress?.program_completion_percent ?? 0) > 0
                    ? `Pick up where you left off — you're ${(progress.program_completion_percent ?? 0).toFixed(1)}% through the program`
                    : "Start your trading training journey — your first lesson is ready!"}
                </p>
                {(progress?.program_completion_percent ?? 0) > 0 && (
                  <div className="h-1.5 rounded-full bg-white/20 overflow-hidden mb-5 max-w-sm">
                    <div
                      className="h-full rounded-full bg-white/80"
                      style={{ width: `${progress?.program_completion_percent ?? 0}%` }}
                    />
                  </div>
                )}
                <Link
                  href={`/lessons/${progress.next_module_id}/${progress.next_chunk_id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 shadow-lg shadow-violet-900/30 transition-all hover:bg-white/95 hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {(progress?.program_completion_percent ?? 0) > 0 ? "Resume Lesson" : "Start First Lesson"}
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
              </>
            ) : (
              <>
                <p className="text-violet-200/80 text-sm mb-4">
                  All lessons complete! Keep sharpening your skills with scenarios.
                </p>
                <Link
                  href="/scenario"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-700 shadow-lg shadow-violet-900/30 transition-all hover:bg-white/95 hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Go to Scenarios
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions — spans 2 cols */}
        <div ref={actionsRef} className="grid grid-cols-2 gap-3 lg:col-span-2">
          <Link href="/scenario" className="group">
            <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-blue-500/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.12)] hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute right-0 top-0 h-12 w-12 translate-x-2 -translate-y-2 rounded-full bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mb-3">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
              </div>
              <p className="text-sm font-semibold text-white">New Scenario</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">AI-generated challenge</p>
            </div>
          </Link>

          <Link href="/lessons" className="group">
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-violet-500/40 hover:shadow-[0_0_24px_rgba(139,92,246,0.12)] hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute right-0 top-0 h-12 w-12 translate-x-2 -translate-y-2 rounded-full bg-violet-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400 mb-3">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
              </div>
              <p className="text-sm font-semibold text-white">Lessons</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Structured learning</p>
            </div>
          </Link>

          <Link href="/challenges" className="group">
            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-fuchsia-500/40 hover:shadow-[0_0_24px_rgba(217,70,239,0.12)] hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute right-0 top-0 h-12 w-12 translate-x-2 -translate-y-2 rounded-full bg-fuchsia-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/15 text-fuchsia-400 mb-3">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
              </div>
              <p className="text-sm font-semibold text-white">Challenges</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Head-to-head battles</p>
            </div>
          </Link>

          <Link href="/leaderboard" className="group">
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5 h-full transition-all hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.12)] hover:scale-[1.02] active:scale-[0.98]">
              <div className="absolute right-0 top-0 h-12 w-12 translate-x-2 -translate-y-2 rounded-full bg-amber-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
              </div>
              <p className="text-sm font-semibold text-white">Leaderboard</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">See your ranking</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ── Two-Column: Skills + Badges ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3 mb-8">
        {/* Skills — spans 2 cols */}
        <div ref={skillRef} className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-white">Skill Breakdown</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Based on scenario performance</p>
            </div>
            <Link
              href="/scenario"
              className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              Practice →
            </Link>
          </div>
          <div className="space-y-3">
            {SKILLS.map((skill, i) => (
              <SkillBar key={skill.id} skill={skill} score={skillsData?.skills[skill.id]?.score ?? 0} index={i} />
            ))}
          </div>
        </div>

        {/* Badges — spans 1 col */}
        <div ref={badgeRef} className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">
              Badges
              <span className="ml-2 text-xs font-normal text-zinc-500">
                {badgesData?.total_earned ?? 0} / {badgesData?.total_available ?? 0}
              </span>
            </h2>
            {(badgesData?.badges?.length ?? 0) > 12 && (
              <Link href="/badges" className="text-xs text-violet-400 hover:text-violet-300 transition-colors">
                View all &rarr;
              </Link>
            )}
          </div>
          {badgesData?.badges && badgesData.badges.length > 0 ? (
            <BadgeShowcase badges={badgesData.badges} />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/80 mb-3">
                <svg className="h-6 w-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
              </div>
              <p className="text-sm text-zinc-500">No badges yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Complete lessons and build streaks to earn them
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

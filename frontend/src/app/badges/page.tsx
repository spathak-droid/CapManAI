"use client";

import { useEffect, useRef } from "react";
import { useMyBadges } from "@/lib/hooks";
import BadgeIcon from "@/components/BadgeIcon";
import type { BadgeInfo } from "@/lib/types";
import {
  gsap,
  useTextReveal,
  useProgressFill,
  useScrollReveal,
} from "@/lib/gsap";

type BadgeCategory = BadgeInfo["category"];

const CATEGORY_ORDER: BadgeCategory[] = ["level", "streak", "milestone", "mastery"];

const CATEGORY_META: Record<
  BadgeCategory,
  { label: string; gradient: string; border: string; glow: string }
> = {
  level: {
    label: "Level",
    gradient: "from-blue-400 to-purple-400",
    border: "border-blue-500/20",
    glow: "hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]",
  },
  streak: {
    label: "Streak",
    gradient: "from-orange-400 to-red-400",
    border: "border-orange-500/20",
    glow: "hover:shadow-[0_0_24px_rgba(249,115,22,0.15)]",
  },
  milestone: {
    label: "Milestone",
    gradient: "from-amber-400 to-yellow-500",
    border: "border-amber-500/20",
    glow: "hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]",
  },
  mastery: {
    label: "Mastery",
    gradient: "from-emerald-400 to-green-400",
    border: "border-emerald-500/20",
    glow: "hover:shadow-[0_0_24px_rgba(34,197,94,0.15)]",
  },
};

function BadgeCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/[0.06] bg-zinc-800/50 p-5">
      <div className="mx-auto mb-3 h-16 w-16 rounded-full bg-zinc-700/60" />
      <div className="mx-auto mb-2 h-4 w-24 rounded bg-zinc-700/60" />
      <div className="mx-auto h-3 w-32 rounded bg-zinc-700/40" />
    </div>
  );
}

function BadgesPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero skeleton */}
      <div className="mb-10 rounded-3xl border border-white/[0.06] bg-zinc-900/80 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-zinc-700/60" />
          <div className="h-5 w-64 rounded bg-zinc-700/40" />
          <div className="h-3 w-full max-w-md rounded-full bg-zinc-800" />
        </div>
      </div>
      {/* Grid skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <BadgeCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const { data: badgesData, isLoading, error } = useMyBadges();

  const titleRef = useTextReveal<HTMLHeadingElement>();
  const progressBarRef = useProgressFill<HTMLDivElement>(
    badgesData
      ? (badgesData.total_earned / Math.max(badgesData.total_available, 1)) * 100
      : 0,
    { delay: 0.6 },
  );

  // Group badges by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, BadgeInfo[]>>(
    (acc, cat) => {
      acc[cat] = (badgesData?.badges ?? [])
        .filter((b) => b.category === cat)
        .sort((a, b) => {
          if (a.earned !== b.earned) return a.earned ? -1 : 1;
          return 0;
        });
      return acc;
    },
    {},
  );

  if (isLoading) {
    return <BadgesPageSkeleton />;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error instanceof Error ? error.message : "Failed to load badges"}
        </div>
      </div>
    );
  }

  const totalEarned = badgesData?.total_earned ?? 0;
  const totalAvailable = badgesData?.total_available ?? 0;
  const unlockPct =
    totalAvailable > 0 ? Math.round((totalEarned / totalAvailable) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10">
        {/* Background decoration */}
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-violet-500/[0.08] blur-3xl" aria-hidden="true" />
        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-blue-500/[0.06] blur-3xl" aria-hidden="true" />
        <div className="absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-fuchsia-500/[0.04] blur-3xl" aria-hidden="true" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text & Stats */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-violet-500/30">
                <svg className="h-5 w-5 text-violet-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h1
                ref={titleRef}
                className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent sm:text-4xl"
              >
                Your Badges
              </h1>
            </div>
            <p className="mt-2 text-sm text-zinc-500 max-w-md">
              Collect badges by leveling up, maintaining streaks, hitting milestones, and mastering skills.
            </p>

            {/* Stats row */}
            <div className="mt-5 flex items-center gap-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Earned</p>
                <p className="text-3xl font-bold tabular-nums text-white mt-0.5">
                  {totalEarned}
                  <span className="text-base font-normal text-zinc-500 ml-1">/ {totalAvailable}</span>
                </p>
              </div>
              <div className="h-10 w-px bg-zinc-700/50" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Unlocked</p>
                <p className="text-3xl font-bold tabular-nums text-white mt-0.5">
                  {unlockPct}
                  <span className="text-base font-normal text-zinc-500 ml-0.5">%</span>
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 max-w-sm">
              <div className="h-2.5 rounded-full bg-zinc-800/80 overflow-hidden">
                <div
                  ref={progressBarRef}
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500"
                />
              </div>
            </div>
          </div>

          {/* Right — Preview of earned badges */}
          <div className="shrink-0 self-center sm:self-auto">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:flex-col sm:gap-1">
              {(badgesData?.badges ?? [])
                .filter((b) => b.earned)
                .slice(0, 5)
                .map((badge) => (
                  <div
                    key={badge.key}
                    className="group relative flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800/50 ring-1 ring-white/[0.06] transition-all hover:scale-110 hover:ring-violet-500/30"
                    title={badge.name}
                  >
                    <BadgeIcon badgeKey={badge.key} category={badge.category} earned size={40} />
                  </div>
                ))}
              {totalEarned > 5 && (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-800/50 ring-1 ring-white/[0.06]">
                  <span className="text-xs font-semibold text-zinc-400">+{totalEarned - 5}</span>
                </div>
              )}
              {totalEarned === 0 && (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-800/40 ring-1 ring-white/[0.04]">
                  <svg className="h-10 w-10 text-zinc-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Sections ── */}
      {CATEGORY_ORDER.map((cat) => {
        const badges = grouped[cat];
        if (!badges || badges.length === 0) return null;
        const meta = CATEGORY_META[cat];

        return (
          <CategorySection key={cat} category={cat} meta={meta} badges={badges} />
        );
      })}

      {/* Empty state */}
      {(badgesData?.badges ?? []).length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80">
            <svg
              className="h-8 w-8 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold text-zinc-300">No badges yet</p>
          <p className="mt-1 text-sm text-zinc-500">
            Complete lessons, build streaks, and master skills to earn badges.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Category Section with GSAP stagger reveal ── */
function CategorySection({
  category,
  meta,
  badges,
}: {
  category: BadgeCategory;
  meta: (typeof CATEGORY_META)[BadgeCategory];
  badges: BadgeInfo[];
}) {
  const sectionRef = useScrollReveal<HTMLDivElement>({ y: 30 });
  const gridRef = useRef<HTMLDivElement>(null);

  // Stagger-reveal badge cards when section scrolls into view
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = grid.querySelectorAll(".badge-card");
    if (!cards.length) return;

    gsap.set(cards, { opacity: 0, y: 20, scale: 0.9 });

    const tween = gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      stagger: 0.06,
      duration: 0.5,
      ease: "back.out(1.4)",
      scrollTrigger: {
        trigger: grid,
        start: "top 88%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [badges]);

  return (
    <div ref={sectionRef} className="mb-10">
      {/* Category header */}
      <div className="mb-4 flex items-center gap-3">
        <h2
          className={`text-lg font-semibold bg-gradient-to-r ${meta.gradient} bg-clip-text text-transparent`}
        >
          {meta.label}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-white/[0.06] to-transparent" />
        <span className="text-xs text-zinc-500 tabular-nums">
          {badges.filter((b) => b.earned).length} / {badges.length}
        </span>
      </div>

      {/* Badge grid */}
      <div
        ref={gridRef}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {badges.map((badge) => (
          <BadgeCard
            key={badge.key}
            badge={badge}
            category={category}
            meta={meta}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Individual Badge Card ── */
function BadgeCard({
  badge,
  category,
  meta,
}: {
  badge: BadgeInfo;
  category: BadgeCategory;
  meta: (typeof CATEGORY_META)[BadgeCategory];
}) {
  return (
    <div
      className={`badge-card group relative overflow-hidden rounded-2xl border bg-zinc-900/70 p-5 text-center transition-all duration-200 hover:scale-[1.03] ${
        badge.earned
          ? `${meta.border} ${meta.glow} hover:border-opacity-60`
          : "border-white/[0.04] opacity-60 hover:opacity-80"
      }`}
    >
      {/* Earned glow background */}
      {badge.earned && (
        <div
          className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(circle at 50% 30%, rgba(139,92,246,0.08), transparent 70%)",
          }}
          aria-hidden="true"
        />
      )}

      {/* Badge icon */}
      <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center">
        <BadgeIcon
          badgeKey={badge.key}
          category={category}
          earned={badge.earned}
          size={64}
        />
        {/* Lock overlay for unearned badges */}
        {!badge.earned && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800/90 ring-1 ring-white/10">
              <svg
                className="h-3.5 w-3.5 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Badge name */}
      <p
        className={`text-sm font-semibold ${badge.earned ? "text-white" : "text-zinc-500"}`}
      >
        {badge.name}
      </p>

      {/* Description — visible on hover */}
      <p className="mt-1 text-xs text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 line-clamp-2">
        {badge.description}
      </p>
    </div>
  );
}

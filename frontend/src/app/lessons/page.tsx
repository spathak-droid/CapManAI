"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { preload } from "swr";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonModules, useLessonProgress, useStreak } from "@/lib/hooks";
import { LessonsPageSkeleton } from "@/components/skeletons/LessonsPageSkeleton";
import type { LessonProgressSummary, ModuleProgress } from "@/lib/types";
import { fetchLessonModule } from "@/lib/api";
import {
  gsap,
  useTextReveal,
  useStaggerReveal,
  useProgressFill,
} from "@/lib/gsap";

function moduleProgressMap(
  progress: LessonProgressSummary | null | undefined
): Record<string, ModuleProgress> {
  if (!progress) return {};
  return Object.fromEntries(
    progress.module_progress.map((item) => [item.module_id, item])
  );
}

/** Wrapper component so each progress bar can call useProgressFill independently */
function AnimatedProgressBar({
  completion,
  gradient,
}: {
  completion: number;
  gradient?: string;
}) {
  const barRef = useProgressFill<HTMLDivElement>(Math.max(completion, 2));
  return (
    <div
      ref={barRef}
      className={`h-2 rounded-full ${gradient ?? "bg-gradient-to-r from-blue-500 to-violet-500"}`}
    />
  );
}

/** SVG circular progress ring for program completion */
function CompletionRing({
  percent,
  size = 110,
}: {
  percent: number;
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
    return () => {
      tween.kill();
    };
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
          stroke="url(#completionGradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
        <defs>
          <linearGradient
            id="completionGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">
          {percent.toFixed(0)}%
        </span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Complete
        </span>
      </div>
    </div>
  );
}

function getBadgeIcon(name: string): string {
  if (name.includes("Streak")) return "🔥";
  if (name.includes("Mastery")) return "⭐";
  if (name.includes("Finisher") || name.includes("Complete")) return "🏆";
  return "🎖️";
}

export default function LessonsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const authReady = !authLoading && !!user && user.role === "student";
  const {
    data: modules,
    error: modulesError,
    isLoading: modulesLoading,
  } = useLessonModules(authReady);
  const {
    data: progress,
    error: progressError,
    isLoading: progressLoading,
  } = useLessonProgress(authReady);
  const { data: streak, isLoading: streakLoading } = useStreak(authReady);

  const isLoading =
    authLoading || modulesLoading || progressLoading || streakLoading;
  const error = modulesError || progressError;

  const progressByModule = useMemo(
    () => moduleProgressMap(progress),
    [progress]
  );

  // GSAP hooks
  const heroTitleRef = useTextReveal<HTMLHeadingElement>();
  const statsGridRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.1 });
  const moduleListRef = useStaggerReveal<HTMLDivElement>({
    childSelector: ":scope > a",
    stagger: 0.08,
  });

  // Hero entrance animation
  const heroRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!heroRef.current || isLoading) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-label", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power3.out",
      });
      gsap.from(".hero-subtitle", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.2,
        ease: "power3.out",
      });
      gsap.from(".hero-ring-wrap", {
        opacity: 0,
        scale: 0.5,
        duration: 0.8,
        delay: 0.3,
        ease: "back.out(1.7)",
      });
    }, heroRef);
    return () => ctx.revert();
  }, [isLoading]);

  // Preload first module and "next" module in background so opening them is instant
  const preloadedModules = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!modules?.length) return;
    const toPreload = [modules[0].module_id];
    if (
      progress?.next_module_id &&
      progress.next_module_id !== modules[0].module_id
    ) {
      toPreload.push(progress.next_module_id);
    }
    toPreload.forEach((id) => {
      if (preloadedModules.current.has(id)) return;
      preloadedModules.current.add(id);
      preload(`lesson-module-${id}`, () => fetchLessonModule(id));
    });
  }, [modules, progress?.next_module_id]);

  // Show skeleton while auth or data is loading — never redirect during loading
  if (authLoading || isLoading) {
    return <LessonsPageSkeleton />;
  }

  // Only redirect AFTER auth is fully resolved
  if (!user) {
    router.replace("/auth/login");
    return <LessonsPageSkeleton />;
  }
  if (user.role !== "student") {
    router.replace(user.role === "educator" ? "/dashboard" : "/");
    return <LessonsPageSkeleton />;
  }

  const programPct = progress?.program_completion_percent ?? 0;
  const currentStreak = streak?.current_streak ?? 0;

  const trackColor = (track: string) => {
    if (track === "foundation")
      return {
        border: "border-blue-500/20",
        borderHover: "hover:border-blue-500/50",
        bg: "bg-blue-500/10",
        text: "text-blue-400",
        label: "text-blue-300/80",
        pillBg: "bg-blue-500/15",
        pillText: "text-blue-300",
        glow: "hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]",
        accent: "bg-blue-500",
        gradientBar:
          "bg-gradient-to-r from-blue-500 to-blue-400",
        dotFilled: "bg-blue-400",
        dotEmpty: "bg-blue-500/20",
      };
    if (track === "core")
      return {
        border: "border-amber-500/20",
        borderHover: "hover:border-amber-500/50",
        bg: "bg-amber-500/10",
        text: "text-amber-400",
        label: "text-amber-300/80",
        pillBg: "bg-amber-500/15",
        pillText: "text-amber-300",
        glow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
        accent: "bg-amber-500",
        gradientBar:
          "bg-gradient-to-r from-amber-500 to-yellow-400",
        dotFilled: "bg-amber-400",
        dotEmpty: "bg-amber-500/20",
      };
    return {
      border: "border-violet-500/20",
      borderHover: "hover:border-violet-500/50",
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      label: "text-violet-300/80",
      pillBg: "bg-violet-500/15",
      pillText: "text-violet-300",
      glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
      accent: "bg-violet-500",
      gradientBar:
        "bg-gradient-to-r from-violet-500 to-fuchsia-400",
      dotFilled: "bg-violet-400",
      dotEmpty: "bg-violet-500/20",
    };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10"
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/[0.07] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-blue-500/[0.05] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-fuchsia-500/[0.04] blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left text */}
          <div className="min-w-0">
            <p className="hero-label text-sm font-medium uppercase tracking-widest text-zinc-500">
              Structured Learning
            </p>
            <h1
              ref={heroTitleRef}
              className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Lessons
              </span>
            </h1>
            <p className="hero-subtitle mt-2 text-sm text-zinc-500 max-w-md">
              Master trading concepts in bite-sized chunks. Progress through
              foundations, core strategies, and advanced techniques at your own
              pace.
            </p>
          </div>

          {/* Right — Completion Ring */}
          <div className="hero-ring-wrap shrink-0 self-center sm:self-auto">
            <CompletionRing percent={programPct} size={120} />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error instanceof Error ? error.message : "Failed to load lessons"}
        </div>
      )}

      {/* ── Stats Row ── */}
      {progress && (
        <div
          ref={statsGridRef}
          className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
        >
          {/* Program */}
          <div className="group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-zinc-900/70 p-5 transition-all hover:border-blue-500/40 hover:shadow-[0_0_24px_rgba(59,130,246,0.1)]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-blue-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 mb-3">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Program
            </p>
            <p className="text-2xl font-bold tabular-nums text-white mt-0.5">
              {programPct.toFixed(1)}
              <span className="text-sm font-normal text-zinc-500 ml-0.5">
                %
              </span>
            </p>
          </div>

          {/* Lesson XP */}
          <div className="group relative overflow-hidden rounded-2xl border border-amber-500/20 bg-zinc-900/70 p-5 transition-all hover:border-amber-500/40 hover:shadow-[0_0_24px_rgba(245,158,11,0.1)]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-amber-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 mb-3">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Lesson XP
            </p>
            <p className="text-2xl font-bold tabular-nums text-white mt-0.5">
              {progress.lesson_xp_total.toLocaleString()}
            </p>
          </div>

          {/* Streak */}
          <div className="group relative overflow-hidden rounded-2xl border border-orange-500/20 bg-zinc-900/70 p-5 transition-all hover:border-orange-500/40 hover:shadow-[0_0_24px_rgba(249,115,22,0.1)]">
            <div className="absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full bg-orange-500/10 blur-2xl transition-opacity group-hover:opacity-100 opacity-60" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400 mb-3">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Streak
            </p>
            <p className="text-2xl font-bold tabular-nums text-white mt-0.5">
              {currentStreak}
              <span className="text-sm font-normal text-zinc-500 ml-0.5">
                days
              </span>
            </p>
          </div>

          {/* Next Best Action CTA */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-800/90 p-5 shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:shadow-[0_0_40px_rgba(139,92,246,0.35)]">
            <div
              className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,255,255,0.12),transparent)]"
              aria-hidden
            />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white mb-3">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
              Next Best Action
            </p>
            {progress.next_module_id && progress.next_chunk_id ? (
              <Link
                href={`/lessons/${progress.next_module_id}/${progress.next_chunk_id}`}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-violet-700 shadow-lg shadow-violet-900/30 transition hover:bg-white/95 hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Resume</span>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            ) : (
              <p className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-200">
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                All complete
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Badges ── */}
      {progress?.badges && progress.badges.length > 0 && (
        <div className="mb-10 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6">
          <h2 className="text-base font-semibold text-white mb-4">
            Badges
            <span className="ml-2 text-xs font-normal text-zinc-500">
              {progress.badges.length} earned
            </span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {progress.badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 text-xs font-medium text-emerald-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/[0.14] hover:scale-[1.05]"
              >
                {getBadgeIcon(badge)} {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Module List ── */}
      <div ref={moduleListRef} className="space-y-4">
        {(modules ?? []).map((module) => {
          const moduleProgress = progressByModule[module.module_id];
          const completion = moduleProgress?.completion_percent ?? 0;
          const masteredChunks = moduleProgress?.mastered_chunks ?? 0;
          const totalChunks = module.chunk_ids?.length ?? module.chunk_count ?? 4;
          const colors = trackColor(module.track);

          return (
            <Link
              key={module.module_id}
              href={`/lessons/${module.module_id}`}
              className={`group relative block overflow-hidden rounded-2xl border bg-zinc-900/60 p-5 pl-0 transition-all hover:bg-zinc-900/80 hover:scale-[1.005] ${colors.border} ${colors.borderHover} ${colors.glow}`}
            >
              <div className="flex">
                {/* Left accent stripe */}
                <div
                  className={`w-[3px] shrink-0 rounded-full ${colors.accent} self-stretch mr-5 ml-0`}
                />

                <div className="flex-1 min-w-0 pr-5">
                  {/* Track pill */}
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${colors.pillBg} ${colors.pillText} mb-2`}
                  >
                    {module.track} &middot; Module {module.order}
                  </span>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white group-hover:text-white">
                        {module.title}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
                        <span>{totalChunks} chunks</span>
                        <span className="text-zinc-700">&middot;</span>
                        <span>{module.estimated_minutes} mins</span>
                        <span className="text-zinc-700">&middot;</span>
                        <span className="truncate">
                          {module.objective ?? "Foundations"}
                        </span>
                      </p>
                    </div>

                    {/* Completion % */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-2xl font-bold tabular-nums ${
                          completion >= 100
                            ? "text-emerald-400"
                            : completion > 0
                              ? "text-white"
                              : "text-zinc-600"
                        }`}
                      >
                        {completion.toFixed(0)}%
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 transition-all group-hover:border-white/20 group-hover:bg-white/10">
                        Open
                        <svg
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 overflow-hidden rounded-full bg-zinc-800/80">
                    <AnimatedProgressBar
                      completion={completion}
                      gradient={colors.gradientBar}
                    />
                  </div>

                  {/* Mastered chunk dots */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {Array.from({ length: totalChunks }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-full transition-colors ${
                          i < masteredChunks
                            ? colors.dotFilled
                            : colors.dotEmpty
                        }`}
                        title={
                          i < masteredChunks
                            ? `Chunk ${i + 1}: Mastered`
                            : `Chunk ${i + 1}: Not mastered`
                        }
                      />
                    ))}
                    <span className="ml-1.5 text-[10px] text-zinc-600">
                      {masteredChunks}/{totalChunks} mastered
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

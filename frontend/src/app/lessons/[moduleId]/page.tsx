"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonModule, useLessonProgress } from "@/lib/hooks";
import { ModuleDetailSkeleton } from "@/components/skeletons/ModuleDetailSkeleton";
import { gsap, useStaggerReveal, useScrollReveal } from "@/lib/gsap";
import type { ChunkProgress } from "@/lib/types";

const TRACK_LABELS: Record<string, string> = {
  foundation: "Foundation",
  core: "Core",
  capstone: "Advanced",
};

const TRACK_GRADIENTS: Record<string, { bg: string; ring: [string, string] }> = {
  foundation: {
    bg: "from-blue-600/90 via-blue-700/80 to-indigo-900/90",
    ring: ["#3b82f6", "#6366f1"],
  },
  core: {
    bg: "from-amber-500/90 via-amber-600/80 to-orange-800/90",
    ring: ["#f59e0b", "#f97316"],
  },
  advanced: {
    bg: "from-violet-600/90 via-purple-700/80 to-indigo-900/90",
    ring: ["#8b5cf6", "#a855f7"],
  },
  capstone: {
    bg: "from-violet-600/90 via-purple-700/80 to-indigo-900/90",
    ring: ["#8b5cf6", "#a855f7"],
  },
};

/** SVG circular progress ring with GSAP-animated stroke */
function ProgressRing({
  percent,
  size = 140,
  gradientId,
  colors,
}: {
  percent: number;
  size?: number;
  gradientId: string;
  colors: [string, string];
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const r = (size - 14) / 2;
  const circumference = 2 * Math.PI * r;

  useEffect(() => {
    if (!ringRef.current) return;
    gsap.set(ringRef.current, { strokeDashoffset: circumference });
    const tween = gsap.to(ringRef.current, {
      strokeDashoffset: circumference - (percent / 100) * circumference,
      duration: 1.5,
      delay: 0.6,
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
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="7"
        />
        <circle
          ref={ringRef}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{percent}%</span>
        <span className="text-[10px] uppercase tracking-widest text-white/50">
          Complete
        </span>
      </div>
    </div>
  );
}

export default function ModuleDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId as string;

  const authReady = !authLoading && !!user && user.role === "student";
  const {
    data: moduleDetail,
    error: moduleError,
    isLoading: moduleLoading,
  } = useLessonModule(authReady ? moduleId : null);
  const { data: progress } = useLessonProgress(authReady);

  const chunkProgressMap = useMemo(
    () => progress?.chunk_progress ?? {},
    [progress]
  );
  const moduleProgress = useMemo(
    () => progress?.module_progress.find((p) => p.module_id === moduleId),
    [progress, moduleId]
  );

  const stepsWithStatus = useMemo(() => {
    if (!moduleDetail?.chunks) return [];
    return moduleDetail.chunks.map((chunk, index) => {
      const cp = chunkProgressMap[chunk.chunk_id] as
        | ChunkProgress
        | undefined;
      const completed = cp?.completed ?? false;
      const prevCompleted =
        index === 0
          ? true
          : ((
              chunkProgressMap[
                moduleDetail.chunks[index - 1].chunk_id
              ] as ChunkProgress | undefined
            )?.completed ?? false);
      const locked = !prevCompleted;
      const isActive = !locked && !completed;
      return { chunk, completed, locked, isActive };
    });
  }, [moduleDetail, chunkProgressMap]);

  const firstActiveChunkId = useMemo(
    () =>
      stepsWithStatus.find((s) => s.isActive)?.chunk.chunk_id ??
      moduleDetail?.chunk_ids?.[0],
    [stepsWithStatus, moduleDetail?.chunk_ids]
  );

  // GSAP refs
  const heroRef = useRef<HTMLDivElement>(null);
  const timelineRef = useStaggerReveal<HTMLUListElement>({
    stagger: 0.12,
    y: 30,
    childSelector: ":scope > li",
  });
  const timelineSectionRef = useScrollReveal<HTMLDivElement>({ y: 30 });

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current || !moduleDetail) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-badge", {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power3.out",
      });
      gsap.from(".hero-title", {
        opacity: 0,
        y: 30,
        duration: 0.7,
        delay: 0.1,
        ease: "power3.out",
      });
      gsap.from(".hero-desc", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.25,
        ease: "power3.out",
      });
      gsap.from(".hero-pills", {
        opacity: 0,
        y: 15,
        duration: 0.5,
        delay: 0.35,
        ease: "power3.out",
      });
      gsap.from(".hero-ring", {
        opacity: 0,
        scale: 0.5,
        duration: 0.8,
        delay: 0.4,
        ease: "back.out(1.7)",
      });
      gsap.from(".hero-cta", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.55,
        ease: "power3.out",
      });
    }, heroRef);
    return () => ctx.revert();
  }, [moduleDetail]);

  if (authLoading || moduleLoading) {
    return <ModuleDetailSkeleton />;
  }

  if (!user) {
    router.replace("/auth/login");
    return <ModuleDetailSkeleton />;
  }
  if (user.role !== "student") {
    router.replace(user.role === "educator" ? "/dashboard" : "/");
    return <ModuleDetailSkeleton />;
  }

  if (!moduleDetail || moduleError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-400">
          {moduleError instanceof Error
            ? moduleError.message
            : "Module not found."}
        </p>
        <Link
          href="/lessons"
          className="mt-4 inline-block text-sm text-zinc-400 hover:text-white"
        >
          Back to Lessons
        </Link>
      </div>
    );
  }

  const totalChunks = moduleDetail.chunk_ids?.length ?? 0;
  const completedCount = moduleProgress?.completed_chunks ?? 0;
  const progressPercent =
    totalChunks > 0 ? Math.round((completedCount / totalChunks) * 100) : 0;
  const difficultyLabel =
    TRACK_LABELS[moduleDetail.track] ?? moduleDetail.track;
  const trackGradient =
    TRACK_GRADIENTS[moduleDetail.track] ?? TRACK_GRADIENTS.foundation;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Back Link (pill style) ── */}
      <Link
        href="/lessons"
        className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-zinc-900/60 px-4 py-2 text-sm text-zinc-400 transition-all hover:border-white/[0.12] hover:bg-zinc-800/80 hover:text-white"
      >
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
            d="M15 19l-7-7 7-7"
          />
        </svg>
        All Lessons
      </Link>

      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className={`relative mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br ${trackGradient.bg} p-8 sm:p-10`}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-white/[0.04] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-1/3 top-1/2 h-40 w-40 rounded-full bg-white/[0.03] blur-2xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text content */}
          <div className="min-w-0 flex-1">
            {/* Track badge pill */}
            <div className="hero-badge">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                <svg
                  className="h-3 w-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {difficultyLabel} Track
              </span>
            </div>

            {/* Module title */}
            <h1 className="hero-title mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {moduleDetail.title}
            </h1>

            {/* Objective description */}
            <p className="hero-desc mt-3 max-w-lg text-sm leading-relaxed text-white/70">
              {moduleDetail.objective
                ? `Master ${moduleDetail.objective.replace(/_/g, " ")} from basics through practice.`
                : "Learn in short chunks with quizzes and scenario practice."}
            </p>

            {/* Metadata pills */}
            <div className="hero-pills mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                ~{moduleDetail.estimated_minutes} min
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                {totalChunks} steps
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm">
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {completedCount}/{totalChunks} done
              </span>
            </div>

            {/* CTA button */}
            {firstActiveChunkId && (
              <div className="hero-cta mt-6">
                <Link
                  href={`/lessons/${moduleId}/${firstActiveChunkId}`}
                  className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-bold shadow-lg shadow-black/20 transition-all hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                  style={{ color: trackGradient.ring[0] }}
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {completedCount > 0 ? "Resume Learning" : "Start Learning"}
                </Link>
              </div>
            )}
          </div>

          {/* Right — Progress Ring */}
          <div className="hero-ring shrink-0 self-center sm:self-auto">
            <ProgressRing
              percent={progressPercent}
              size={140}
              gradientId="moduleProgressGrad"
              colors={trackGradient.ring}
            />
          </div>
        </div>
      </div>

      {/* ── Steps Timeline ── */}
      <div ref={timelineSectionRef} className="mt-12">
        <h2 className="mb-6 text-lg font-semibold text-white">
          Learning Path
        </h2>

        <div className="relative">
          {/* Gradient vertical line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-0.5"
            aria-hidden="true"
            style={{
              background:
                completedCount > 0
                  ? `linear-gradient(to bottom, #10b981 ${
                      (completedCount / totalChunks) * 100
                    }%, rgba(63,63,70,0.4) ${
                      (completedCount / totalChunks) * 100
                    }%)`
                  : "rgba(63,63,70,0.4)",
            }}
          />

          <ul ref={timelineRef} className="relative space-y-5">
            {stepsWithStatus.map(
              ({ chunk, completed, locked, isActive }, index) => (
                <li key={chunk.chunk_id} className="relative flex gap-5">
                  {/* ── Step Circle (48px) ── */}
                  <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center">
                    {completed ? (
                      /* Completed: emerald filled with checkmark + glow */
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.4)]">
                        <svg
                          className="h-6 w-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    ) : isActive ? (
                      /* Active: blue pulsing ring with play icon */
                      <div className="relative flex h-12 w-12 items-center justify-center">
                        <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900">
                          <svg
                            className="h-5 w-5 text-blue-400 ml-0.5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      /* Locked: zinc with lock icon */
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-700/60 bg-zinc-900/80">
                        <svg
                          className="h-5 w-5 text-zinc-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* ── Step Card ── */}
                  <div
                    className={`relative min-w-0 flex-1 overflow-hidden rounded-2xl border p-5 transition-all ${
                      completed
                        ? "border-emerald-500/25 bg-zinc-900/70 shadow-[0_0_24px_rgba(16,185,129,0.06)]"
                        : isActive
                          ? "border-blue-500/30 bg-zinc-900/70 shadow-[0_0_24px_rgba(59,130,246,0.08)]"
                          : "border-zinc-800/60 bg-zinc-900/40 opacity-60"
                    }`}
                  >
                    {/* Left accent border */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${
                        completed
                          ? "bg-emerald-500"
                          : isActive
                            ? "bg-blue-500"
                            : "bg-zinc-700/50"
                      }`}
                    />

                    {/* Completed corner badge */}
                    {completed && (
                      <div className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
                        <svg
                          className="h-4 w-4 text-emerald-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Step number badge */}
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        completed
                          ? "bg-emerald-500/10 text-emerald-400"
                          : isActive
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      Step {index + 1}
                    </span>

                    {/* Title */}
                    <h3
                      className={`mt-2 text-base font-semibold ${
                        locked ? "text-zinc-500" : "text-white"
                      }`}
                    >
                      {chunk.title}
                    </h3>

                    {/* Learning goal */}
                    <p
                      className={`mt-1.5 text-sm leading-relaxed ${
                        locked ? "text-zinc-600" : "text-zinc-400"
                      }`}
                    >
                      {chunk.learning_goal}
                    </p>

                    {/* Quiz hint */}
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                      <svg
                        className={`h-3.5 w-3.5 ${
                          completed
                            ? "text-emerald-500/60"
                            : isActive
                              ? "text-amber-400/70"
                              : "text-zinc-600"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span>Complete lesson &amp; quiz to pass</span>
                    </div>

                    {/* CTA / Review link */}
                    {isActive && (
                      <Link
                        href={`/lessons/${moduleId}/${chunk.chunk_id}`}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] hover:shadow-blue-500/30 active:scale-[0.98]"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {completedCount > 0 ? "Resume" : "Start"}
                      </Link>
                    )}
                    {completed && !isActive && (
                      <Link
                        href={`/lessons/${moduleId}/${chunk.chunk_id}`}
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
                      >
                        Review
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
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </Link>
                    )}
                  </div>
                </li>
              )
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

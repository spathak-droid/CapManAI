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

function moduleProgressMap(progress: LessonProgressSummary | null | undefined): Record<string, ModuleProgress> {
  if (!progress) return {};
  return Object.fromEntries(progress.module_progress.map((item) => [item.module_id, item]));
}

export default function LessonsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const authReady = !authLoading && !!user && user.role === "student";
  const { data: modules, error: modulesError, isLoading: modulesLoading } = useLessonModules(authReady);
  const { data: progress, error: progressError, isLoading: progressLoading } = useLessonProgress(authReady);
  const { data: streak, isLoading: streakLoading } = useStreak(authReady);

  const isLoading = authLoading || modulesLoading || progressLoading || streakLoading;
  const error = modulesError || progressError;

  const progressByModule = useMemo(() => moduleProgressMap(progress), [progress]);

  // Preload first module and "next" module in background so opening them is instant
  const preloadedModules = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!modules?.length) return;
    const toPreload = [modules[0].module_id];
    if (progress?.next_module_id && progress.next_module_id !== modules[0].module_id) {
      toPreload.push(progress.next_module_id);
    }
    toPreload.forEach((id) => {
      if (preloadedModules.current.has(id)) return;
      preloadedModules.current.add(id);
      preload(`lesson-module-${id}`, () => fetchLessonModule(id));
    });
  }, [modules, progress?.next_module_id]);

  if (!authLoading && !user) {
    router.replace("/auth/login");
    return null;
  }
  if (!authLoading && user && user.role !== "student") {
    router.replace(user.role === "educator" ? "/dashboard" : "/");
    return null;
  }

  if (isLoading) {
    return <LessonsPageSkeleton />;
  }

  const trackColor = (track: string) => {
    if (track === "foundation") return { border: "border-blue-500/40", bg: "bg-blue-500/10", text: "text-blue-400", label: "text-blue-300/80" };
    if (track === "core") return { border: "border-amber-500/40", bg: "bg-amber-500/10", text: "text-amber-400", label: "text-amber-300/80" };
    return { border: "border-violet-500/40", bg: "bg-violet-500/10", text: "text-violet-400", label: "text-violet-300/80" };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero header */}
      <div className="mb-10 relative">
        <div className="absolute -left-2 top-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 blur-2xl" aria-hidden />
        <h1 className="relative bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Lessons
        </h1>
        <p className="mt-3 text-base text-zinc-400 max-w-xl">
          Learn in short chunks, take micro-quizzes, and build mastery from fundamentals to capstone.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error instanceof Error ? error.message : "Failed to load lessons"}
        </div>
      )}

      {progress && (
        <div className="mb-10 grid gap-4 md:grid-cols-4">
          <div className="group relative overflow-hidden rounded-2xl border border-blue-500/25 bg-zinc-900/80 p-5 shadow-[0_0_24px_rgba(59,130,246,0.08)] transition-all hover:border-blue-500/40 hover:shadow-[0_0_32px_rgba(59,130,246,0.12)]">
            <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-blue-500/10 blur-2xl transition-opacity group-hover:opacity-80" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Program</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">{progress.program_completion_percent.toFixed(1)}%</p>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-zinc-900/80 p-5 shadow-[0_0_24px_rgba(245,158,11,0.06)] transition-all hover:border-amber-500/40 hover:shadow-[0_0_32px_rgba(245,158,11,0.1)]">
            <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-amber-500/10 blur-2xl transition-opacity group-hover:opacity-80" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Lesson XP</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">{progress.lesson_xp_total}</p>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-orange-500/25 bg-zinc-900/80 p-5 shadow-[0_0_24px_rgba(249,115,22,0.06)] transition-all hover:border-orange-500/40 hover:shadow-[0_0_32px_rgba(249,115,22,0.1)]">
            <div className="absolute right-0 top-0 h-20 w-20 translate-x-4 -translate-y-4 rounded-full bg-orange-500/10 blur-2xl transition-opacity group-hover:opacity-80" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Streak</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-white">{streak?.current_streak ?? 0}d</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-fuchsia-800/90 p-5 shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:shadow-[0_0_40px_rgba(139,92,246,0.35)]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(255,255,255,0.12),transparent)]" aria-hidden />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/80">Next Best Action</p>
            {progress.next_module_id && progress.next_chunk_id ? (
              <Link
                href={`/lessons/${progress.next_module_id}/${progress.next_chunk_id}`}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 shadow-lg shadow-violet-900/30 transition hover:bg-white/95 hover:shadow-violet-900/40"
              >
                <span>Resume</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            ) : (
              <p className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-200">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                All chunks complete
              </p>
            )}
          </div>
        </div>
      )}

      {progress?.badges && progress.badges.length > 0 && (
        <div className="card-glow mb-10 p-5">
          <p className="mb-3 text-sm font-semibold text-white">Badges</p>
          <div className="flex flex-wrap gap-2">
            {progress.badges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {(modules ?? []).map((module, index) => {
          const moduleProgress = progressByModule[module.module_id];
          const completion = moduleProgress?.completion_percent ?? 0;
          const colors = trackColor(module.track);
          return (
            <Link
              key={module.module_id}
              href={`/lessons/${module.module_id}`}
              className={`group block rounded-2xl border bg-zinc-900/60 p-5 transition-all hover:border-white/15 hover:bg-zinc-900/80 hover:shadow-[0_0_32px_rgba(0,0,0,0.2)] ${colors.border} animate-fade-in`}
              style={{ animationDelay: `${index * 70}ms`, animationFillMode: "both" }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colors.bg} ${colors.text}`}>
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${colors.label}`}>
                      {module.track} · Module {module.order}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-white group-hover:text-white">{module.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-zinc-500">
                      <span>{module.chunk_ids?.length ?? 4} chunks</span>
                      <span className="text-zinc-600">·</span>
                      <span>{module.estimated_minutes} mins</span>
                      <span className="text-zinc-600">·</span>
                      <span>Objective: {module.objective ?? "Foundations"}</span>
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-all group-hover:border-blue-500/40 group-hover:bg-blue-500/10 group-hover:text-blue-200">
                  Open Module
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </span>
              </div>

              {(completion > 0 || (moduleProgress?.mastered_chunks ?? 0) > 0) && (
                <>
                  <div className="mt-4 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width] duration-500 ease-out"
                      style={{ width: `${Math.max(completion, 2)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {completion.toFixed(1)}% complete · {moduleProgress?.mastered_chunks ?? 0}/{module.chunk_ids?.length ?? 4} mastered
                  </p>
                </>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

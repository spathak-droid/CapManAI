"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonModule, useLessonProgress } from "@/lib/hooks";
import { ModuleDetailSkeleton } from "@/components/skeletons/ModuleDetailSkeleton";
import type { LessonModuleDetail, ChunkProgress } from "@/lib/types";

const TRACK_LABELS: Record<string, string> = {
  foundation: "Beginner",
  core: "Intermediate",
  capstone: "Advanced",
};

export default function ModuleDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams<{ moduleId: string }>();
  const moduleId = params.moduleId as string;

  const authReady = !authLoading && !!user && user.role === "student";
  const { data: moduleDetail, error: moduleError, isLoading: moduleLoading } = useLessonModule(authReady ? moduleId : null);
  const { data: progress } = useLessonProgress(authReady);

  const chunkProgressMap = useMemo(() => progress?.chunk_progress ?? {}, [progress]);
  const moduleProgress = useMemo(
    () => progress?.module_progress.find((p) => p.module_id === moduleId),
    [progress, moduleId],
  );

  const stepsWithStatus = useMemo(() => {
    if (!moduleDetail?.chunks) return [];
    return moduleDetail.chunks.map((chunk, index) => {
      const cp = chunkProgressMap[chunk.chunk_id] as ChunkProgress | undefined;
      const completed = cp?.completed ?? false;
      const prevCompleted = index === 0 ? true : (chunkProgressMap[moduleDetail.chunks[index - 1].chunk_id] as ChunkProgress | undefined)?.completed ?? false;
      const locked = !prevCompleted;
      const isActive = !locked && !completed;
      return { chunk, completed, locked, isActive };
    });
  }, [moduleDetail, chunkProgressMap]);

  const firstActiveChunkId = useMemo(
    () => stepsWithStatus.find((s) => s.isActive)?.chunk.chunk_id ?? moduleDetail?.chunk_ids?.[0],
    [stepsWithStatus, moduleDetail?.chunk_ids],
  );

  if (!authLoading && !user) {
    router.replace("/auth/login");
    return null;
  }
  if (!authLoading && user && user.role !== "student") {
    router.replace(user.role === "educator" ? "/dashboard" : "/");
    return null;
  }

  if (moduleLoading) {
    return <ModuleDetailSkeleton />;
  }

  if (!moduleDetail || moduleError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <p className="text-red-400">{moduleError instanceof Error ? moduleError.message : "Module not found."}</p>
        <Link href="/lessons" className="mt-4 inline-block text-sm text-zinc-400 hover:text-white">
          ← All Lessons
        </Link>
      </div>
    );
  }

  const totalChunks = moduleDetail.chunk_ids?.length ?? 0;
  const completedCount = moduleProgress?.completed_chunks ?? 0;
  const progressPercent = totalChunks > 0 ? Math.round((completedCount / totalChunks) * 100) : 0;
  const difficultyLabel = TRACK_LABELS[moduleDetail.track] ?? moduleDetail.track;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/lessons"
        className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        ← All Lessons
      </Link>

      {/* Module overview card */}
      <div className="card-glow mt-6 flex gap-5 rounded-2xl p-6">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-white">{moduleDetail.title}</h1>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              {difficultyLabel}
            </span>
          </div>
          <p className="mt-2 text-zinc-400">
            {moduleDetail.objective
              ? `Master ${moduleDetail.objective.replace(/_/g, " ")} from basics through practice.`
              : "Learn in short chunks with quizzes and scenario practice."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
            <span>~{moduleDetail.estimated_minutes} min</span>
            <span>{totalChunks} steps</span>
          </div>
          <div className="mt-4">
            <p className="text-xs text-zinc-500">
              {completedCount} of {totalChunks} steps complete
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          {firstActiveChunkId && (
            <Link
              href={`/lessons/${moduleId}/${firstActiveChunkId}`}
              className="btn-primary-glow mt-4 flex shrink-0 items-center gap-2 self-start rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              {completedCount > 0 ? "Resume" : "Start"}
            </Link>
          )}
        </div>
      </div>

      {/* Steps timeline */}
      <div className="mt-10">
        <div className="relative flex">
          {/* Vertical line */}
          <div
            className="absolute left-5 top-6 bottom-6 w-0.5 bg-blue-500/30"
            aria-hidden="true"
          />

          <ul className="flex-1 space-y-6">
            {stepsWithStatus.map(({ chunk, completed, locked, isActive }, index) => (
              <li key={chunk.chunk_id} className="relative flex gap-4">
                {/* Step icon */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-zinc-700 bg-zinc-900">
                  {locked ? (
                    <svg className="h-5 w-5 text-zinc-500" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  ) : completed ? (
                    <svg className="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>

                {/* Step card */}
                <div
                  className={`min-w-0 flex-1 rounded-2xl border p-5 ${
                    completed
                      ? "border-emerald-500/30 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
                      : locked
                        ? "card-glow border-zinc-700/50 bg-zinc-900/50 opacity-90"
                        : "card-glow border-white/[0.08] bg-zinc-900/30"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-zinc-500">Step {chunk.order}</span>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium text-amber-300">
                      Lesson
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {moduleDetail.objective ? moduleDetail.objective.replace(/_/g, " ") : "Foundations"} · {difficultyLabel}
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-white">{chunk.title}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-400">{chunk.learning_goal}</p>
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500">
                    <svg className="h-4 w-4 text-amber-400/80" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>Complete lesson & quiz to pass</span>
                  </div>
                  {isActive && (
                    <Link
                      href={`/lessons/${moduleId}/${chunk.chunk_id}`}
                      className="btn-primary-glow mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                      </svg>
                      {completedCount > 0 ? "Resume" : "Start"}
                    </Link>
                  )}
                  {completed && !isActive && (
                    <Link
                      href={`/lessons/${moduleId}/${chunk.chunk_id}`}
                      className="mt-4 inline-flex text-sm text-zinc-400 hover:text-white"
                    >
                      Review →
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

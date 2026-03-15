"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text */}
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-28 mb-3" />
            <Skeleton className="h-9 w-56 sm:w-72 mb-2" />
            <Skeleton className="h-4 w-72 sm:w-96 mb-5" />
            {/* XP bar */}
            <div className="max-w-sm">
              <div className="flex items-center justify-between mb-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          </div>
          {/* Right — Level Ring */}
          <div className="shrink-0 self-center sm:self-auto">
            <Skeleton className="h-[130px] w-[130px] rounded-full" />
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-white/[0.06] bg-zinc-900/70 p-5">
            <Skeleton className="h-9 w-9 rounded-xl mb-3" />
            <Skeleton className="h-3 w-16 mb-1.5" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>

      {/* ── Two-Column: Continue Training + Quick Actions ── */}
      <div className="grid gap-4 lg:grid-cols-5 mb-8">
        {/* Continue Training — spans 3 cols */}
        <div className="relative overflow-hidden rounded-2xl lg:col-span-3 p-6 sm:p-8 bg-violet-900/50">
          <Skeleton className="h-4 w-40 mb-2 bg-white/10" />
          <Skeleton className="h-3 w-64 mb-4 bg-white/10" />
          <Skeleton className="h-1.5 w-full max-w-sm rounded-full mb-5 bg-white/10" />
          <Skeleton className="h-10 w-36 rounded-xl bg-white/20" />
        </div>

        {/* Quick Actions — spans 2 cols */}
        <div className="grid grid-cols-2 gap-3 lg:col-span-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-zinc-900/70 p-5">
              <Skeleton className="h-10 w-10 rounded-xl mb-3" />
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>

      {/* ── Two-Column: Skills + Badges ── */}
      <div className="grid gap-4 lg:grid-cols-3 mb-8">
        {/* Skills — spans 2 cols */}
        <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <Skeleton className="h-5 w-36 mb-1.5" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-3 w-16" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-40 shrink-0" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-10 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Badges — spans 1 col */}
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-7 w-28 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

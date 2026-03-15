"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function ChallengesSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-900/60 p-8 sm:p-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="mt-3 h-9 w-72" />
            <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center rounded-2xl border border-white/[0.06] bg-zinc-800/40 px-4 py-3 min-w-[80px]">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="mt-1 h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Challenge */}
      <div className="mb-8 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </div>

      {/* Open Challenges */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-6 w-40" />
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div>
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-1 h-3 w-20" />
                </div>
              </div>
              <Skeleton className="h-9 w-24 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      {/* Active Challenges */}
      <div className="mb-8">
        <Skeleton className="mb-4 h-6 w-44" />
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1 h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Completed Challenges */}
      <div>
        <Skeleton className="mb-4 h-6 w-52" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

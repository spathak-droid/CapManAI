"use client";

import { Skeleton } from "@/components/ui/Skeleton";

/** Matches ScenarioCard layout: header, situation, question, stat pills, chart area. */
export function ScenarioCardSkeleton() {
  return (
    <div className="card-glow rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-32 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-6 max-w-md w-[80%]" />
      <Skeleton className="mt-2 h-4 w-full" />
      <Skeleton className="mt-1 h-4 w-5/6" />
      <div className="mt-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="mt-6 rounded-xl bg-zinc-950/50 p-3">
        <Skeleton className="h-[180px] w-full rounded-lg" />
        <Skeleton className="mx-auto mt-2 h-3 w-36" />
      </div>
      <Skeleton className="mt-4 h-5 w-3/4 max-w-sm" />
      <Skeleton className="mt-2 h-4 w-full" />
    </div>
  );
}

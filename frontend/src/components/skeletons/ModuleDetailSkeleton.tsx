"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function ModuleDetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-24" />

      <div className="card-glow mt-6 flex gap-5 rounded-2xl p-6">
        <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="flex gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div>
            <Skeleton className="h-3 w-36" />
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <Skeleton className="h-full w-1/4 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      <div className="mt-10">
        <div className="relative flex">
          <div className="absolute left-5 top-6 bottom-6 w-0.5 bg-zinc-700/50" aria-hidden />
          <ul className="flex-1 space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="relative flex gap-4">
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-5">
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-14 rounded" />
                  </div>
                  <Skeleton className="mt-1 h-3 w-32" />
                  <Skeleton className="mt-2 h-5 max-w-[85%]" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4 max-w-sm" />
                  <Skeleton className="mt-4 h-10 w-24 rounded-xl" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

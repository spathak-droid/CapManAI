"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function LessonsPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-2 h-4 max-w-md" />
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-glow p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-8 w-14" />
          </div>
        ))}
      </div>

      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card-glow p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-1 h-6 w-3/4 max-w-xs" />
                <Skeleton className="mt-1 h-4 w-full max-w-sm" />
              </div>
              <Skeleton className="h-10 w-28 shrink-0 rounded-xl" />
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <Skeleton className="h-full w-1/3 rounded-full" />
            </div>
            <Skeleton className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

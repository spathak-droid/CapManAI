"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function LessonChunkSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-32 rounded-full" />
      </div>

      <div className="mb-4 flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>

      <div className="card-glow mb-6 rounded-2xl p-6">
        <Skeleton className="h-8 w-3/4 max-w-xs" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
        <div className="mt-6 space-y-5">
          <section>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-5/6" />
          </section>
          <section>
            <Skeleton className="h-3 w-16" />
            <div className="mt-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-2 h-4 w-full" />
              <Skeleton className="mt-1 h-4 max-w-[85%]" />
            </div>
          </section>
          <div className="rounded-xl border-2 border-blue-500/40 bg-blue-500/10 px-4 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1 h-4 w-full" />
          </div>
        </div>
        <Skeleton className="mt-6 h-10 w-44 rounded-xl" />
      </div>
    </div>
  );
}

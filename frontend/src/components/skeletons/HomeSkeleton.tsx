"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Welcome header */}
      <div className="mb-8">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>

      {/* Stats strip - 4 cards */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-glow p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-2 h-2 w-full" />
          </div>
        ))}
      </div>

      {/* Badges section */}
      <div className="card-glow mb-8 p-5">
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-full" />
          ))}
        </div>
      </div>

      {/* Continue training */}
      <Skeleton className="mb-8 h-32 w-full rounded-2xl" />

      {/* Quick actions */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>

      {/* Skill bars */}
      <div className="card-glow p-5">
        <Skeleton className="mb-4 h-5 w-32" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="mb-3 flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 flex-1 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

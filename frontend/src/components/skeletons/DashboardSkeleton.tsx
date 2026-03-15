"use client";

import { Skeleton } from "@/components/ui/Skeleton";

const TIER_KEYS = 3;
const SKILL_ROWS = 6;
const STUDENT_ROWS = 5;

export function DashboardSkeleton() {
  return (
    <>
      <div className="mb-12 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: TIER_KEYS }, (_, i) => (
          <div key={i} className="glass rounded-2xl border border-zinc-700/50 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                <div>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-1 h-3 w-48" />
                </div>
              </div>
              <Skeleton className="h-9 w-10" />
            </div>
            <ul className="mt-5 space-y-1.5">
              {[1, 2, 3].map((j) => (
                <li key={j} className="flex items-center gap-2">
                  <Skeleton className="h-1.5 w-1.5 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="card-glow mb-12 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Skill
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                Tier 1
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                Tier 2
              </th>
              <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                Tier 3
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKILL_ROWS }, (_, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="px-5 py-3.5">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Skeleton className="mx-auto h-6 w-8 rounded-md" />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Skeleton className="mx-auto h-6 w-8 rounded-md" />
                </td>
                <td className="px-5 py-3.5 text-center">
                  <Skeleton className="mx-auto h-6 w-8 rounded-md" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Skeleton className="mb-4 h-6 w-36" />
      <div className="card-glow mb-12 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Student
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Overall Tier
              </th>
              <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Avg Score
              </th>
              <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Skill Tiers
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: STUDENT_ROWS }, (_, i) => (
              <tr key={i} className="border-b border-white/[0.04]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-6 w-20 rounded-full" />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Skeleton className="ml-auto h-4 w-12" />
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-4 w-28" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

"use client";

import { Skeleton } from "@/components/ui/Skeleton";

const ROWS = 8;

export function LeaderboardSkeleton() {
  return (
    <div className="card-glow overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left">
          <thead className="bg-zinc-800/50">
            <tr>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Rank
              </th>
              <th className="px-6 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Trader
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                XP
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                Level
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, i) => (
              <tr
                key={i}
                className="border-b border-white/[0.04]"
              >
                <td className="px-6 py-4">
                  <Skeleton className="h-8 w-8 rounded-full" />
                </td>
                <td className="px-6 py-4">
                  <Skeleton className="h-4 w-28" />
                </td>
                <td className="px-6 py-4 text-right">
                  <Skeleton className="ml-auto h-4 w-16" />
                </td>
                <td className="px-6 py-4 text-right">
                  <Skeleton className="ml-auto h-6 w-12 rounded-full" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
  );
}

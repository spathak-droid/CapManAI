"use client";

import { useLeaderboard } from "@/lib/hooks";
import { LeaderboardSkeleton } from "@/components/skeletons/LeaderboardSkeleton";

export default function LeaderboardPage() {
  const { data: entries, error, isLoading } = useLeaderboard();

  function rankBadge(rank: number) {
    if (rank === 1)
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-sm font-bold text-black shadow-lg shadow-yellow-500/30">
          1
        </span>
      );
    if (rank === 2)
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 text-sm font-bold text-black">
          2
        </span>
      );
    if (rank === 3)
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-600 to-amber-700 text-sm font-bold text-white">
          3
        </span>
      );
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-medium text-zinc-500">
        {rank}
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <h1 className="mb-2 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        Leaderboard
      </h1>
      <p className="mb-10 text-zinc-500">
        Top traders ranked by XP. Climb the ranks through consistent practice
        and mastery.
      </p>

      {/* Loading */}
      {isLoading && (
        <LeaderboardSkeleton />
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load leaderboard"}
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
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
              {(entries ?? []).map((entry) => (
                <tr
                  key={entry.user_id}
                  className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                    entry.rank === 1
                      ? "bg-blue-500/[0.03]"
                      : entry.rank === 2
                        ? "bg-blue-500/[0.02]"
                        : entry.rank === 3
                          ? "bg-blue-500/[0.01]"
                          : ""
                  }`}
                >
                  <td className="px-6 py-4">{rankBadge(entry.rank)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-semibold ${
                        entry.rank <= 3
                          ? "text-white"
                          : "text-zinc-300"
                      }`}
                    >
                      {entry.username}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono text-blue-400 font-semibold">
                      {entry.xp_total.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300">
                      Lv. {entry.level}
                    </span>
                  </td>
                </tr>
              ))}
              {(entries ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-zinc-500"
                  >
                    No entries yet. Be the first to train and earn XP!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

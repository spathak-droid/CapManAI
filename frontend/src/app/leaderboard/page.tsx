"use client";

import { useState } from "react";
import { useLeaderboard, useDynamicLeaderboard, useMyRank } from "@/lib/hooks";
import { useRealtimeEvent } from "@/lib/useRealtimeEvent";
import { LeaderboardSkeleton } from "@/components/skeletons/LeaderboardSkeleton";

type SortTab = "composite" | "mastery" | "xp";

const TABS: { key: SortTab; label: string }[] = [
  { key: "composite", label: "Composite" },
  { key: "mastery", label: "Mastery" },
  { key: "xp", label: "XP" },
];

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<SortTab>("composite");

  // Fetch data based on active tab
  const { data: xpEntries, error: xpError, isLoading: xpLoading, mutate: mutateXp } = useLeaderboard();
  const { data: dynamicEntries, error: dynamicError, isLoading: dynamicLoading, mutate: mutateDynamic } = useDynamicLeaderboard(activeTab);
  const { data: myRank, mutate: mutateRank } = useMyRank();

  // Live-refresh leaderboard when any player earns XP
  useRealtimeEvent("leaderboard_update", () => {
    mutateXp();
    mutateDynamic();
    mutateRank();
  });

  const isXpTab = activeTab === "xp";
  const isLoading = isXpTab ? xpLoading : dynamicLoading;
  const error = isXpTab ? xpError : dynamicError;

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
      <p className="mb-6 text-zinc-500">
        Top traders ranked by performance. Climb the ranks through consistent
        practice and mastery.
      </p>

      {/* User Rank Card */}
      {myRank && (
        <div className="mb-6 rounded-xl border border-purple-500/20 bg-purple-500/[0.07] p-4 backdrop-blur-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {rankBadge(myRank.rank)}
              <div>
                <p className="text-sm text-zinc-400">Your Rank</p>
                <p className="text-lg font-bold text-white">
                  #{myRank.rank}{" "}
                  <span className="text-sm font-normal text-zinc-500">
                    of {myRank.total_users}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <p className="text-zinc-500">XP</p>
                <p className="font-mono font-semibold text-blue-400">
                  {myRank.xp_total.toLocaleString()}
                </p>
              </div>
              <div className="text-center">
                <p className="text-zinc-500">Mastery</p>
                <p className="font-mono font-semibold text-violet-400">
                  {(myRank.mastery_score * 100).toFixed(0)}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-zinc-500">Composite</p>
                <p className="font-mono font-semibold text-emerald-400">
                  {myRank.composite_score.toFixed(1)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sort Tabs */}
      <div className="mb-6 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "border border-zinc-700 text-zinc-400 hover:border-purple-500/50 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && <LeaderboardSkeleton />}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error instanceof Error
            ? error.message
            : "Failed to load leaderboard"}
        </div>
      )}

      {/* XP Tab Content */}
      {!isLoading && !error && isXpTab && (
        <div className="card-glow overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
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
                {(xpEntries ?? []).map((entry) => (
                  <tr
                    key={entry.user_id}
                    className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                      myRank && entry.user_id === myRank.user_id
                        ? "bg-purple-500/[0.08] ring-1 ring-inset ring-purple-500/20"
                        : entry.rank === 1
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
                          myRank && entry.user_id === myRank.user_id
                            ? "text-purple-300"
                            : entry.rank <= 3
                              ? "text-white"
                              : "text-zinc-300"
                        }`}
                      >
                        {entry.username}
                        {myRank && entry.user_id === myRank.user_id && (
                          <span className="ml-2 text-xs text-purple-400">
                            (you)
                          </span>
                        )}
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
                {(xpEntries ?? []).length === 0 && (
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
        </div>
      )}

      {/* Dynamic (Mastery / Composite) Tab Content */}
      {!isLoading && !error && !isXpTab && (
        <div className="card-glow overflow-hidden backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="px-4 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-6">
                    Rank
                  </th>
                  <th className="px-4 py-4 text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-6">
                    Trader
                  </th>
                  <th className="hidden px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 sm:table-cell sm:px-6">
                    XP
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-6">
                    Mastery
                  </th>
                  <th className="hidden px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 sm:table-cell sm:px-6">
                    Attempts
                  </th>
                  <th className="px-4 py-4 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-6">
                    Composite
                  </th>
                </tr>
              </thead>
              <tbody>
                {(dynamicEntries ?? []).map((entry) => (
                  <tr
                    key={entry.user_id}
                    className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${
                      myRank && entry.user_id === myRank.user_id
                        ? "bg-purple-500/[0.08] ring-1 ring-inset ring-purple-500/20"
                        : entry.rank === 1
                          ? "bg-blue-500/[0.03]"
                          : entry.rank === 2
                            ? "bg-blue-500/[0.02]"
                            : entry.rank === 3
                              ? "bg-blue-500/[0.01]"
                              : ""
                    }`}
                  >
                    <td className="px-4 py-4 sm:px-6">
                      {rankBadge(entry.rank)}
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span
                        className={`font-semibold ${
                          myRank && entry.user_id === myRank.user_id
                            ? "text-purple-300"
                            : entry.rank <= 3
                              ? "text-white"
                              : "text-zinc-300"
                        }`}
                      >
                        {entry.username}
                        {myRank && entry.user_id === myRank.user_id && (
                          <span className="ml-2 text-xs text-purple-400">
                            (you)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 text-right sm:table-cell sm:px-6">
                      <span className="font-mono text-blue-400 font-semibold">
                        {entry.xp_total.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right sm:px-6">
                      <span className="font-mono text-violet-400 font-semibold">
                        {(entry.mastery_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="hidden px-4 py-4 text-right sm:table-cell sm:px-6">
                      <span className="text-zinc-400">
                        {entry.repetition_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right sm:px-6">
                      <span className="font-mono text-emerald-400 font-semibold">
                        {entry.composite_score.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                ))}
                {(dynamicEntries ?? []).length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-zinc-500"
                    >
                      No entries yet. Be the first to train and earn XP!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

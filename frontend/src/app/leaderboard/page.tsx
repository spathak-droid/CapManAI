"use client";

import { useEffect, useState } from "react";
import { fetchLeaderboard } from "@/lib/api";
import type { LeaderboardEntry } from "@/lib/types";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setEntries)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load leaderboard"),
      )
      .finally(() => setLoading(false));
  }, []);

  function rankBadge(rank: number) {
    if (rank === 1)
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold text-yellow-900">
          1
        </span>
      );
    if (rank === 2)
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-300 text-sm font-bold text-gray-800">
          2
        </span>
      );
    if (rank === 3)
      return (
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-sm font-bold text-white">
          3
        </span>
      );
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-medium text-gray-500 dark:text-gray-400">
        {rank}
      </span>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Leaderboard
      </h1>
      <p className="mb-8 text-gray-600 dark:text-gray-400">
        Top traders ranked by XP. Climb the ranks through consistent practice
        and mastery.
      </p>

      {loading && (
        <div className="flex justify-center py-20">
          <svg
            className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Rank
                </th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Trader
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">
                  XP
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">
                  Level
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {entries.map((entry) => (
                <tr
                  key={entry.user_id}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    entry.rank <= 3 ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  <td className="px-6 py-4">{rankBadge(entry.rank)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`font-semibold ${
                        entry.rank <= 3
                          ? "text-gray-900 dark:text-white"
                          : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {entry.username}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {entry.xp_total.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      Lv. {entry.level}
                    </span>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-10 text-center text-gray-500 dark:text-gray-400"
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

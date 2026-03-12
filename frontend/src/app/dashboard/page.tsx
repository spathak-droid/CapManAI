"use client";

import { useEffect, useState } from "react";
import { fetchDashboardOverview } from "@/lib/api";
import MTSSHeatmap from "@/components/MTSSHeatmap";
import type { DashboardOverview, MTSSStudent } from "@/lib/types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardOverview()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load dashboard"),
      )
      .finally(() => setLoading(false));
  }, []);

  function tierCardColor(tier: 1 | 2 | 3) {
    switch (tier) {
      case 1:
        return "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20";
      case 2:
        return "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20";
      case 3:
        return "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20";
    }
  }

  function tierTextColor(tier: 1 | 2 | 3) {
    switch (tier) {
      case 1:
        return "text-green-700 dark:text-green-400";
      case 2:
        return "text-yellow-700 dark:text-yellow-400";
      case 3:
        return "text-red-700 dark:text-red-400";
    }
  }

  const allStudents: MTSSStudent[] = data
    ? data.tiers.flatMap((t) => t.students)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Educator Dashboard
      </h1>
      <p className="mb-8 text-gray-600 dark:text-gray-400">
        MTSS-powered overview of student progress. Monitor tiers, track skill
        development, and identify students who need support.
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
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* Tier Overview Cards */}
          <div className="mb-10 grid gap-6 md:grid-cols-3">
            {data.tiers.map((tier) => (
              <div
                key={tier.tier}
                className={`rounded-xl border-2 p-6 ${tierCardColor(tier.tier)}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3
                    className={`text-lg font-bold ${tierTextColor(tier.tier)}`}
                  >
                    Tier {tier.tier}
                  </h3>
                  <span
                    className={`text-3xl font-extrabold ${tierTextColor(tier.tier)}`}
                  >
                    {tier.count}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tier.label}
                </p>
                {/* Student list */}
                {tier.students.length > 0 && (
                  <ul className="mt-4 space-y-1">
                    {tier.students.map((s) => (
                      <li
                        key={s.user_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700 dark:text-gray-300">
                          {s.username}
                        </span>
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                          {s.xp.toLocaleString()} XP
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {/* Total Students */}
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Skill Breakdown
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {data.total_students} students total
            </span>
          </div>

          {/* Heatmap */}
          {allStudents.length > 0 && data.skill_names.length > 0 ? (
            <MTSSHeatmap
              students={allStudents}
              skillNames={data.skill_names}
            />
          ) : (
            <div className="rounded-xl border border-gray-200 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No student skill data available yet.
            </div>
          )}
        </>
      )}
    </div>
  );
}

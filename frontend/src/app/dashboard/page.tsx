"use client";

import { useEffect, useState } from "react";
import { fetchDashboardOverview, fetchMTSSTiers } from "@/lib/api";
import MTSSHeatmap from "@/components/MTSSHeatmap";
import type { ClassOverview, StudentTierInfo } from "@/lib/types";

const SKILL_LABELS: Record<string, string> = {
  price_action: "Price Action",
  options_chain: "Options Chain",
  strike_select: "Strike Selection",
  risk_mgmt: "Risk Management",
  position_size: "Position Sizing",
  regime_id: "Regime Identification",
  vol_assess: "Volatility Assessment",
  trade_mgmt: "Trade Management",
};

const TIER_CONFIG: Record<string, { label: string; description: string; cardClass: string; textClass: string; badgeClass: string }> = {
  tier_1: {
    label: "Tier 1 — On Track",
    description: "Students meeting all benchmarks",
    cardClass: "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20",
    textClass: "text-green-700 dark:text-green-400",
    badgeClass: "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200",
  },
  tier_2: {
    label: "Tier 2 — Needs Support",
    description: "Students requiring targeted intervention",
    cardClass: "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20",
    textClass: "text-yellow-700 dark:text-yellow-400",
    badgeClass: "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200",
  },
  tier_3: {
    label: "Tier 3 — Intensive Intervention",
    description: "Students needing intensive support",
    cardClass: "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20",
    textClass: "text-red-700 dark:text-red-400",
    badgeClass: "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200",
  },
};

function tierBadgeClass(tier: string): string {
  return TIER_CONFIG[tier]?.badgeClass ?? "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
}

function formatSkillName(key: string): string {
  return SKILL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<ClassOverview | null>(null);
  const [students, setStudents] = useState<StudentTierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([fetchDashboardOverview(), fetchMTSSTiers()])
      .then(([ov, st]) => {
        setOverview(ov);
        setStudents(st);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load dashboard"),
      )
      .finally(() => setLoading(false));
  }, []);

  const tierKeys = ["tier_1", "tier_2", "tier_3"];
  const skillKeys = overview ? Object.keys(overview.skill_breakdown) : [];
  const totalStudents = overview
    ? Object.values(overview.tier_counts).reduce((a, b) => a + b, 0)
    : 0;

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

      {overview && (
        <>
          {/* ── Tier Overview Cards ── */}
          <div className="mb-10 grid gap-6 md:grid-cols-3">
            {tierKeys.map((tierKey) => {
              const config = TIER_CONFIG[tierKey];
              if (!config) return null;
              const count = overview.tier_counts[tierKey] ?? 0;
              const names = overview.students_by_tier[tierKey] ?? [];
              return (
                <div
                  key={tierKey}
                  className={`rounded-xl border-2 p-6 ${config.cardClass}`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className={`text-lg font-bold ${config.textClass}`}>
                      {config.label}
                    </h3>
                    <span className={`text-3xl font-extrabold ${config.textClass}`}>
                      {count}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {config.description}
                  </p>
                  {names.length > 0 && (
                    <ul className="mt-4 space-y-1">
                      {names.map((name) => (
                        <li
                          key={name}
                          className="text-sm text-gray-700 dark:text-gray-300"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Skill Breakdown Table ── */}
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Skill Breakdown
            </h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {totalStudents} students total
            </span>
          </div>

          {skillKeys.length > 0 ? (
            <div className="mb-10 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Skill
                    </th>
                    {tierKeys.map((tk) => (
                      <th
                        key={tk}
                        className={`px-4 py-3 text-center font-medium ${TIER_CONFIG[tk]?.textClass ?? ""}`}
                      >
                        {TIER_CONFIG[tk]?.label.split(" — ")[0] ?? tk}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {skillKeys.map((skill) => {
                    const tiers = overview.skill_breakdown[skill] ?? {};
                    return (
                      <tr key={skill} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatSkillName(skill)}
                        </td>
                        {tierKeys.map((tk) => (
                          <td
                            key={tk}
                            className={`px-4 py-3 text-center font-bold ${tierBadgeClass(tk)} rounded`}
                          >
                            {tiers[tk] ?? 0}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-10 rounded-xl border border-gray-200 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No skill breakdown data available yet.
            </div>
          )}

          {/* ── Student Detail View ── */}
          <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
            Student Details
          </h2>

          {students.length > 0 ? (
            <div className="mb-10 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Student
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Overall Tier
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 dark:text-gray-300">
                      Avg Score
                    </th>
                    <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                      Skill Tiers
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {students.map((student) => {
                    const isExpanded = expandedId === student.user_id;
                    const skills = Object.entries(student.skill_tiers);
                    return (
                      <tr
                        key={student.user_id}
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : student.user_id)
                        }
                      >
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {student.username}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(student.overall_tier)}`}
                          >
                            {student.overall_tier.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-white">
                          {student.avg_score.toFixed(1)}
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <div className="flex flex-wrap gap-2">
                              {skills.map(([skill, tier]) => (
                                <span
                                  key={skill}
                                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tierBadgeClass(tier)}`}
                                >
                                  {formatSkillName(skill)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Click to expand {skills.length} skills
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-10 rounded-xl border border-gray-200 p-10 text-center text-gray-500 dark:border-gray-700 dark:text-gray-400">
              No student tier data available yet.
            </div>
          )}

          {/* ── MTSS Heatmap ── */}
          {students.length > 0 && (
            <>
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">
                MTSS Heatmap
              </h2>
              <MTSSHeatmap students={students} />
            </>
          )}
        </>
      )}
    </div>
  );
}

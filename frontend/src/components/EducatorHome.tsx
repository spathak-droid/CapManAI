"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useMTSSTiers } from "@/lib/hooks";

function formatSkillName(skill: string): string {
  return skill
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function findWeakestSkill(skillTiers: Record<string, string>): { name: string; tier: string } | null {
  const entries = Object.entries(skillTiers);
  // Prefer tier_3 first, then tier_2
  const tier3 = entries.find(([, t]) => t === "tier_3");
  if (tier3) return { name: tier3[0], tier: tier3[1] };
  const tier2 = entries.find(([, t]) => t === "tier_2");
  if (tier2) return { name: tier2[0], tier: tier2[1] };
  return null;
}

function tierBadgeClasses(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    case "tier_2":
      return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    case "tier_3":
      return "bg-red-500/10 text-red-400 border border-red-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
  }
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "Tier 1";
    case "tier_2":
      return "Tier 2";
    case "tier_3":
      return "Tier 3";
    default:
      return tier;
  }
}

export default function EducatorHome() {
  const { user } = useAuth();
  const { data: overview, isLoading: overviewLoading } = useDashboardOverview();
  const { data: students, isLoading: studentsLoading } = useMTSSTiers();

  const isLoading = !user || overviewLoading || studentsLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-zinc-500 text-lg">Loading class data...</div>
        </div>
      </div>
    );
  }

  const tierCounts = overview?.tier_counts ?? {};
  const studentsByTier = overview?.students_by_tier ?? {};
  const tier1Count = tierCounts["tier_1"] ?? 0;
  const tier2Count = tierCounts["tier_2"] ?? 0;
  const tier3Count = tierCounts["tier_3"] ?? 0;
  const totalStudents = tier1Count + tier2Count + tier3Count;

  const allStudents = students ?? [];
  const classAvg =
    allStudents.length > 0
      ? allStudents.reduce((sum, s) => sum + s.avg_score, 0) / allStudents.length
      : 0;

  const needsAttention = allStudents.filter(
    (s) => s.overall_tier === "tier_2" || s.overall_tier === "tier_3"
  );

  const avgColorClass =
    classAvg >= 70
      ? "text-emerald-400"
      : classAvg >= 40
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* 1. Welcome Header */}
      <div className="animate-slide-up" style={{ animationDelay: "0ms" }}>
        <h1 className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent text-4xl font-bold tracking-tight">
          Welcome back, {user?.username}
        </h1>
        <p className="text-zinc-500 mt-1 mb-8">Your class at a glance</p>
      </div>

      {/* 2. Alert Banner */}
      {tier3Count > 0 && (
        <div
          className="animate-slide-up rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-8"
          style={{ animationDelay: "50ms" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-red-300 font-medium">
                ⚠️ {tier3Count} student(s) need intensive support
              </p>
              <p className="text-red-400/70 text-sm mt-1">
                {(studentsByTier["tier_3"] ?? []).join(", ")}
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-red-300 hover:text-red-200 text-sm whitespace-nowrap ml-4"
            >
              View details →
            </Link>
          </div>
        </div>
      )}

      {/* 3. Class Snapshot */}
      <div
        className="animate-slide-up grid md:grid-cols-3 gap-4 mb-8"
        style={{ animationDelay: "100ms" }}
      >
        {/* Total Students */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Total Students</p>
          <p className="text-3xl font-bold text-white mt-1">{totalStudents}</p>
        </div>

        {/* Tier Distribution */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Tier Distribution</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="h-2 w-2 rounded-full inline-block bg-emerald-500" />
              On Track: {tier1Count}
            </div>
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="h-2 w-2 rounded-full inline-block bg-amber-500" />
              Needs Support: {tier2Count}
            </div>
            <div className="flex items-center gap-2 text-zinc-200">
              <span className="h-2 w-2 rounded-full inline-block bg-red-500" />
              Intensive: {tier3Count}
            </div>
          </div>
        </div>

        {/* Class Average */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Class Average</p>
          <p className="mt-1">
            <span className={`text-3xl font-bold ${avgColorClass}`}>
              {classAvg.toFixed(1)}
            </span>
            <span className="text-zinc-500 text-lg ml-1">/ 100</span>
          </p>
        </div>
      </div>

      {/* 4. Tier Distribution Bar */}
      <div
        className="animate-slide-up card-glow p-6 mb-8"
        style={{ animationDelay: "150ms" }}
      >
        <p className="text-sm font-semibold text-white mb-4">Class Distribution</p>
        <div className="h-6 rounded-full overflow-hidden flex bg-zinc-800">
          {totalStudents > 0 && (
            <>
              {tier1Count > 0 && (
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(tier1Count / totalStudents) * 100}%` }}
                />
              )}
              {tier2Count > 0 && (
                <div
                  className="bg-amber-500 transition-all"
                  style={{ width: `${(tier2Count / totalStudents) * 100}%` }}
                />
              )}
              {tier3Count > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(tier3Count / totalStudents) * 100}%` }}
                />
              )}
            </>
          )}
        </div>
        <div className="flex justify-between mt-3 text-sm">
          <span className="text-emerald-400">
            Tier 1 — {tier1Count} ({totalStudents > 0 ? Math.round((tier1Count / totalStudents) * 100) : 0}%)
          </span>
          <span className="text-amber-400">
            Tier 2 — {tier2Count} ({totalStudents > 0 ? Math.round((tier2Count / totalStudents) * 100) : 0}%)
          </span>
          <span className="text-red-400">
            Tier 3 — {tier3Count} ({totalStudents > 0 ? Math.round((tier3Count / totalStudents) * 100) : 0}%)
          </span>
        </div>
      </div>

      {/* 5. Students Needing Attention */}
      <div
        className="animate-slide-up card-glow overflow-hidden mb-8"
        style={{ animationDelay: "200ms" }}
      >
        <div className="p-5">
          <h2 className="text-sm font-semibold text-white">Students Needing Attention</h2>
        </div>
        {needsAttention.length === 0 ? (
          <div className="p-8 text-center text-emerald-400 font-medium">
            All students are on track!
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Student
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Tier
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 text-right">
                  Avg Score
                </th>
                <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Weakest Skill
                </th>
              </tr>
            </thead>
            <tbody>
              {needsAttention.map((student) => {
                const weakest = findWeakestSkill(student.skill_tiers ?? {});
                return (
                  <tr
                    key={student.user_id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3.5 font-medium text-zinc-200">
                      {student.username}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadgeClasses(student.overall_tier)}`}
                      >
                        {tierLabel(student.overall_tier)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-zinc-200">
                      {student.avg_score.toFixed(1)}
                    </td>
                    <td className="px-5 py-3.5">
                      {weakest ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadgeClasses(weakest.tier)}`}
                        >
                          {formatSkillName(weakest.name)}
                        </span>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. Quick Actions */}
      <div
        className="animate-slide-up grid gap-4 md:grid-cols-4 mb-8"
        style={{ animationDelay: "250ms" }}
      >
        <Link
          href="/dashboard"
          className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]"
        >
          <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-blue-500/10">
            <svg
              className="text-blue-400 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">Full Dashboard</p>
        </Link>

        <Link
          href="/leaderboard"
          className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]"
        >
          <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-violet-500/10">
            <svg
              className="text-violet-400 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 01-2.27.79 6.04 6.04 0 01-2.27-.79"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">Leaderboard</p>
        </Link>

        <Link
          href="/scenario"
          className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]"
        >
          <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-emerald-500/10">
            <svg
              className="text-emerald-400 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">Try a Scenario</p>
        </Link>

        <Link
          href="/dashboard/mtss"
          className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(139,92,246,0.12)]"
        >
          <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-violet-500/10">
            <svg
              className="text-violet-400 h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">View Detailed MTSS Analytics</p>
        </Link>
      </div>
    </div>
  );
}

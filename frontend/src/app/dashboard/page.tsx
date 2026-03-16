"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useMTSSTiers } from "@/lib/hooks";
import { exportEducatorCSV } from "@/lib/api";
import MTSSHeatmap from "@/components/MTSSHeatmap";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { formatSkillName } from "@/lib/format";

const TIER_CONFIG: Record<string, { label: string; description: string; color: string; borderColor: string; hoverBorder: string; hoverShadow: string; blurBg: string; iconBg: string; iconText: string; textClass: string; badgeClass: string }> = {
  tier_1: {
    label: "Tier 1 — On Track",
    description: "Students meeting all benchmarks",
    color: "emerald",
    borderColor: "border-emerald-500/20",
    hoverBorder: "hover:border-emerald-500/40",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(34,197,94,0.1)]",
    blurBg: "bg-emerald-500/10",
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-400",
    textClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  tier_2: {
    label: "Tier 2 — Needs Support",
    description: "Students requiring targeted intervention",
    color: "amber",
    borderColor: "border-amber-500/20",
    hoverBorder: "hover:border-amber-500/40",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(245,158,11,0.1)]",
    blurBg: "bg-amber-500/10",
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-400",
    textClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  tier_3: {
    label: "Tier 3 — Intensive",
    description: "Students needing intensive support",
    color: "red",
    borderColor: "border-red-500/20",
    hoverBorder: "hover:border-red-500/40",
    hoverShadow: "hover:shadow-[0_0_24px_rgba(239,68,68,0.1)]",
    blurBg: "bg-red-500/10",
    iconBg: "bg-red-500/15",
    iconText: "text-red-400",
    textClass: "text-red-400",
    badgeClass: "bg-red-500/10 text-red-400 border border-red-500/20",
  },
};

function tierBadgeClass(tier: string): string {
  return TIER_CONFIG[tier]?.badgeClass ?? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: overview, error: overviewError, isLoading: overviewLoading } = useDashboardOverview();
  const { data: students, error: studentsError, isLoading: studentsLoading } = useMTSSTiers();

  useEffect(() => {
    if (!authLoading && user?.role !== "educator") {
      router.replace("/");
    }
  }, [authLoading, user?.role, router]);

  if (!authLoading && user?.role !== "educator") {
    return null;
  }

  const loading = overviewLoading || studentsLoading;
  const error = overviewError || studentsError;

  const tierKeys = ["tier_1", "tier_2", "tier_3"];
  const skillKeys = overview ? Object.keys(overview.skill_breakdown) : [];
  const totalStudents = overview
    ? Object.values(overview.tier_counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* ── Page Header ── */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10">
        {/* Background decoration */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/[0.07] blur-3xl" aria-hidden />
        <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-blue-500/[0.05] blur-3xl" aria-hidden />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="mb-2 text-2xl sm:text-4xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Educator Dashboard
              </span>
            </h1>
            <p className="text-zinc-500 text-sm sm:text-base max-w-lg">
              MTSS-powered overview of student progress. Monitor tiers, track skill
              development, and identify students who need support.
            </p>
          </div>
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportEducatorCSV();
              } catch {
                // silently handle — user sees no download
              } finally {
                setExporting(false);
              }
            }}
            className="rounded-xl bg-white/[0.06] border border-white/[0.08] px-4 py-2 text-sm font-medium text-white hover:bg-white/[0.1] transition-colors shrink-0 self-start disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      {/* ── Loading State ── */}
      {loading && <DashboardSkeleton />}

      {/* ── Error State ── */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load dashboard"}
        </div>
      )}

      {overview && (
        <>
          {/* ── Tier Overview Cards ── */}
          <div className="mb-12 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tierKeys.map((tierKey) => {
              const config = TIER_CONFIG[tierKey];
              if (!config) return null;
              const count = overview.tier_counts[tierKey] ?? 0;
              const names = overview.students_by_tier[tierKey] ?? [];
              return (
                <div
                  key={tierKey}
                  className={`group relative overflow-hidden rounded-2xl border ${config.borderColor} bg-zinc-900/70 p-6 transition-all ${config.hoverBorder} ${config.hoverShadow}`}
                >
                  {/* Corner blur decoration */}
                  <div className={`absolute right-0 top-0 h-16 w-16 translate-x-3 -translate-y-3 rounded-full ${config.blurBg} blur-2xl transition-opacity group-hover:opacity-100 opacity-60`} />

                  <div className="relative flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.iconBg} ${config.iconText}`}>
                        {tierKey === "tier_1" && (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                        {tierKey === "tier_2" && (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                        )}
                        {tierKey === "tier_3" && (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </div>
                      <div>
                        <h3 className={`text-sm font-semibold tracking-wide ${config.textClass}`}>
                          {config.label}
                        </h3>
                        <p className="mt-1 text-xs text-zinc-500">
                          {config.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className={`relative mt-4 text-3xl font-bold tabular-nums ${config.textClass}`}>
                    {count}
                    <span className="text-sm font-normal text-zinc-500 ml-1.5">students</span>
                  </p>

                  {names.length > 0 && (
                    <ul className="relative mt-4 space-y-1.5">
                      {names.map((name) => (
                        <li
                          key={name}
                          className="flex items-center gap-2 text-sm text-zinc-400"
                        >
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.textClass} opacity-60`} />
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
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white">Skill Breakdown</h2>
              <p className="text-xs text-zinc-500">{totalStudents} students total</p>
            </div>
          </div>

          {skillKeys.length > 0 ? (
            <div className="mb-12 rounded-2xl border border-white/[0.06] bg-zinc-900/60 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Skill
                    </th>
                    {tierKeys.map((tk) => (
                      <th
                        key={tk}
                        className="px-3 sm:px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500"
                      >
                        {TIER_CONFIG[tk]?.label.split(" — ")[0] ?? tk}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {skillKeys.map((skill) => {
                    const tiers = overview.skill_breakdown[skill] ?? {};
                    return (
                      <tr
                        key={skill}
                        className="border-b border-white/[0.04] transition-colors hover:bg-violet-500/[0.04]"
                      >
                        <td className="px-3 sm:px-5 py-3.5 font-medium text-zinc-200">
                          {formatSkillName(skill)}
                        </td>
                        {tierKeys.map((tk) => (
                          <td
                            key={tk}
                            className="px-3 sm:px-5 py-3.5 text-center"
                          >
                            <span
                              className={`inline-flex min-w-[2.25rem] items-center justify-center rounded-lg px-2.5 py-1 text-sm font-bold ${tierBadgeClass(tk)}`}
                            >
                              {tiers[tk] ?? 0}
                            </span>
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-12 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-10 text-center text-zinc-500">
              No skill breakdown data available yet.
            </div>
          )}

          {/* ── Student Detail View ── */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15">
              <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Student Details</h2>
              <p className="text-xs text-zinc-500">Click a row to expand skill tiers</p>
            </div>
          </div>

          {students && students.length > 0 ? (
            <div className="mb-12 rounded-2xl border border-white/[0.06] bg-zinc-900/60 overflow-hidden overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Student
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Overall Tier
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500 hidden sm:table-cell">
                      Avg Score
                    </th>
                    <th className="px-3 sm:px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500 hidden md:table-cell">
                      Skill Tiers
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const isExpanded = expandedId === student.user_id;
                    const skills = Object.entries(student.skill_tiers);
                    return (
                      <tr
                        key={student.user_id}
                        className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-violet-500/[0.04]"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : student.user_id)
                        }
                      >
                        <td className="px-3 sm:px-5 py-3.5 font-medium text-zinc-200">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-xs font-bold text-white">
                              {(student.name || student.username || "?").slice(0, 2).toUpperCase()}
                            </span>
                            {student.name || student.username}
                          </div>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(student.overall_tier)}`}
                          >
                            {student.overall_tier.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-3.5 text-right font-mono text-zinc-200 hidden sm:table-cell">
                          {student.avg_score.toFixed(1)}
                        </td>
                        <td className="px-3 sm:px-5 py-3.5 hidden md:table-cell">
                          {isExpanded ? (
                            <div className="flex flex-wrap gap-2">
                              {skills.map(([skill, tier]) => (
                                <span
                                  key={skill}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tierBadgeClass(tier)}`}
                                >
                                  {formatSkillName(skill)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">
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
            <div className="mb-12 rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-10 text-center text-zinc-500">
              No student tier data available yet.
            </div>
          )}

          {/* ── MTSS Heatmap ── */}
          {students && students.length > 0 && (
            <>
              <h2 className="mb-4 border-l-2 border-violet-500 pl-3 text-xl font-semibold text-white">
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

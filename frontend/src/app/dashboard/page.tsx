"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardOverview, useMTSSTiers } from "@/lib/hooks";
import { exportEducatorCSV } from "@/lib/api";
import MTSSHeatmap from "@/components/MTSSHeatmap";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

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
    cardClass: "border-emerald-500/20 bg-emerald-500/5",
    textClass: "text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  },
  tier_2: {
    label: "Tier 2 — Needs Support",
    description: "Students requiring targeted intervention",
    cardClass: "border-amber-500/20 bg-amber-500/5",
    textClass: "text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  },
  tier_3: {
    label: "Tier 3 — Intensive",
    description: "Students needing intensive support",
    cardClass: "border-red-500/20 bg-red-500/5",
    textClass: "text-red-400",
    badgeClass: "bg-red-500/10 text-red-400 border border-red-500/20",
  },
};

function tierBadgeClass(tier: string): string {
  return TIER_CONFIG[tier]?.badgeClass ?? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
}

function formatSkillName(key: string): string {
  return SKILL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: overview, error: overviewError, isLoading: overviewLoading } = useDashboardOverview();
  const { data: students, error: studentsError, isLoading: studentsLoading } = useMTSSTiers();

  if (!authLoading && user?.role !== "educator") {
    router.replace("/");
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
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Educator Dashboard
          </h1>
          <p className="text-zinc-500 text-base">
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
          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
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
          <div className="mb-12 grid gap-5 md:grid-cols-3">
            {tierKeys.map((tierKey) => {
              const config = TIER_CONFIG[tierKey];
              if (!config) return null;
              const count = overview.tier_counts[tierKey] ?? 0;
              const names = overview.students_by_tier[tierKey] ?? [];
              return (
                <div
                  key={tierKey}
                  className={`relative rounded-2xl border p-6 transition-colors ${config.cardClass}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className={`text-sm font-semibold tracking-wide ${config.textClass}`}>
                        {config.label}
                      </h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {config.description}
                      </p>
                    </div>
                    <span className={`text-4xl font-bold tabular-nums ${config.textClass}`}>
                      {count}
                    </span>
                  </div>
                  {names.length > 0 && (
                    <ul className="mt-5 space-y-1.5">
                      {names.map((name) => (
                        <li
                          key={name}
                          className="text-sm text-zinc-400"
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
            <h2 className="text-xl font-semibold text-white">
              Skill Breakdown
            </h2>
            <span className="text-sm text-zinc-500">
              {totalStudents} students total
            </span>
          </div>

          {skillKeys.length > 0 ? (
            <div className="card-glow mb-12 overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Skill
                    </th>
                    {tierKeys.map((tk) => (
                      <th
                        key={tk}
                        className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500"
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
                        className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                      >
                        <td className="px-5 py-3.5 font-medium text-zinc-200">
                          {formatSkillName(skill)}
                        </td>
                        {tierKeys.map((tk) => (
                          <td
                            key={tk}
                            className="px-5 py-3.5 text-center"
                          >
                            <span
                              className={`inline-flex min-w-[2rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold ${tierBadgeClass(tk)}`}
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
            <div className="card-glow mb-12 p-10 text-center text-zinc-500">
              No skill breakdown data available yet.
            </div>
          )}

          {/* ── Student Detail View ── */}
          <h2 className="mb-4 text-xl font-semibold text-white">
            Student Details
          </h2>

          {students && students.length > 0 ? (
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
                  {students.map((student) => {
                    const isExpanded = expandedId === student.user_id;
                    const skills = Object.entries(student.skill_tiers);
                    return (
                      <tr
                        key={student.user_id}
                        className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : student.user_id)
                        }
                      >
                        <td className="px-5 py-3.5 font-medium text-zinc-200">
                          {student.username}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(student.overall_tier)}`}
                          >
                            {student.overall_tier.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-zinc-200">
                          {student.avg_score.toFixed(1)}
                        </td>
                        <td className="px-5 py-3.5">
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
            <div className="card-glow mb-12 p-10 text-center text-zinc-500">
              No student tier data available yet.
            </div>
          )}

          {/* ── MTSS Heatmap ── */}
          {students && students.length > 0 && (
            <>
              <h2 className="mb-4 text-xl font-semibold text-white">
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

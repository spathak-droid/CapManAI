"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useObjectiveDistributions, useMTSSTiers } from "@/lib/hooks";
import ObjectiveHeatmap from "@/components/ObjectiveHeatmap";
import MTSSSkillDrilldown from "@/components/MTSSSkillDrilldown";

function tierBadgeClass(tier: string): string {
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

export default function MTSSAnalyticsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [expandedStudentId, setExpandedStudentId] = useState<number | null>(null);

  const { data: objectives, error: objError, isLoading: objLoading } = useObjectiveDistributions();
  const { data: students, error: studentsError, isLoading: studentsLoading } = useMTSSTiers();

  if (!authLoading && user?.role !== "educator") {
    router.replace("/");
    return null;
  }

  const loading = objLoading || studentsLoading;
  const error = objError || studentsError;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-zinc-300 transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/dashboard" className="hover:text-zinc-300 transition-colors">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-zinc-300">MTSS Analytics</span>
      </nav>

      {/* Page Header */}
      <div className="mb-10">
        <h1 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          MTSS Analytics
        </h1>
        <p className="text-zinc-500 text-base">
          Granular skill-level analysis with objective distributions and personalized intervention recommendations.
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="animate-pulse card-glow p-5">
                <div className="h-4 w-3/4 rounded bg-zinc-800 mb-3" />
                <div className="h-3 w-1/2 rounded bg-zinc-800 mb-3" />
                <div className="h-5 rounded-full bg-zinc-800 mb-2" />
                <div className="h-3 w-full rounded bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load MTSS analytics"}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Section 1: Objective Overview */}
          <div className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Objective Overview
              </h2>
              <span className="text-sm text-zinc-500">
                {objectives?.length ?? 0} objectives
              </span>
            </div>
            <ObjectiveHeatmap objectives={objectives ?? []} />
          </div>

          {/* Section 2: Student Drilldown */}
          <div className="mb-12">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                Student Skill Drilldown
              </h2>
              <span className="text-sm text-zinc-500">
                Click a student to view skills &amp; interventions
              </span>
            </div>

            {students && students.length > 0 ? (
              <div className="space-y-2">
                {students.map((student) => {
                  const isExpanded = expandedStudentId === student.user_id;
                  return (
                    <div
                      key={student.user_id}
                      className="card-glow overflow-hidden"
                    >
                      {/* Student header row */}
                      <button
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                        onClick={() =>
                          setExpandedStudentId(isExpanded ? null : student.user_id)
                        }
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar placeholder */}
                          <div className="h-9 w-9 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-bold text-violet-400">
                            {student.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">
                              {student.username}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Avg: {student.avg_score.toFixed(1)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(student.overall_tier)}`}
                          >
                            {student.overall_tier.replace("_", " ").toUpperCase()}
                          </span>
                          <svg
                            className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                            />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded skill drilldown */}
                      {isExpanded && (
                        <div className="border-t border-white/[0.06]">
                          <MTSSSkillDrilldown
                            userId={student.user_id}
                            username={student.username}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card-glow p-10 text-center text-zinc-500">
                No student data available yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

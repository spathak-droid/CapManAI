"use client";

import { useState } from "react";
import { useStudentSkills, useStudentInterventions } from "@/lib/hooks";
import type { InterventionRecommendation } from "@/lib/types";

interface MTSSSkillDrilldownProps {
  userId: number;
  username: string;
}

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

function scoreBarColor(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "bg-gradient-to-r from-emerald-600 to-emerald-400";
    case "tier_2":
      return "bg-gradient-to-r from-amber-600 to-amber-400";
    case "tier_3":
      return "bg-gradient-to-r from-red-600 to-red-400";
    default:
      return "bg-zinc-500";
  }
}

function tierGlowClass(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "hover:shadow-[0_0_12px_rgba(16,185,129,0.12)]";
    case "tier_2":
      return "hover:shadow-[0_0_12px_rgba(245,158,11,0.12)]";
    case "tier_3":
      return "hover:shadow-[0_0_12px_rgba(239,68,68,0.12)]";
    default:
      return "";
  }
}

function formatSkillName(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MTSSSkillDrilldown({ userId, username }: MTSSSkillDrilldownProps) {
  const { data: skillData, isLoading: skillsLoading } = useStudentSkills(userId);
  const { data: interventions, isLoading: interventionsLoading } = useStudentInterventions(userId);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const isLoading = skillsLoading || interventionsLoading;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 rounded-xl bg-zinc-800/50" />
          </div>
        ))}
      </div>
    );
  }

  const skills = skillData?.skills ?? {};
  const skillEntries = Object.entries(skills);

  // Build a map of interventions by skill name
  const interventionMap: Record<string, InterventionRecommendation> = {};
  if (interventions) {
    for (const iv of interventions) {
      interventionMap[iv.skill] = iv;
    }
  }

  if (skillEntries.length === 0) {
    return (
      <div className="p-6 text-center text-zinc-500 text-sm">
        No skill data available for {username}.
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        Skills for {username}
      </h3>
      {skillEntries.map(([skill, info]) => {
        const intervention = interventionMap[skill];
        const isExpanded = expandedSkill === skill;

        return (
          <div
            key={skill}
            className={`rounded-xl border border-white/[0.06] bg-zinc-900/50 overflow-hidden transition-shadow ${tierGlowClass(info.tier)}`}
          >
            {/* Skill row */}
            <button
              className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/[0.02] transition-colors"
              onClick={() => setExpandedSkill(isExpanded ? null : skill)}
            >
              {/* Skill name */}
              <span className="text-sm font-medium text-zinc-200 min-w-[140px]">
                {formatSkillName(skill)}
              </span>

              {/* Score bar */}
              <div className="flex-1 flex items-center gap-3">
                <div className="flex-1 h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${scoreBarColor(info.tier)}`}
                    style={{ width: `${Math.min(info.score, 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-zinc-400 min-w-[3ch] text-right">
                  {info.score.toFixed(0)}
                </span>
              </div>

              {/* Tier badge */}
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(info.tier)}`}
              >
                {tierLabel(info.tier)}
              </span>

              {/* Attempts */}
              <span className="text-xs text-zinc-500 min-w-[60px] text-right">
                {info.attempts} attempt{info.attempts !== 1 ? "s" : ""}
              </span>

              {/* Expand indicator */}
              <svg
                className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Expanded intervention recommendation */}
            {isExpanded && intervention && (
              <div className="border-t border-white/[0.06] p-4 bg-zinc-900/30">
                <div className="mb-3">
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-1 flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
                    </svg>
                    Recommendation
                  </p>
                  <p className="text-sm text-zinc-300">{intervention.recommendation}</p>
                </div>

                {intervention.suggested_activities.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
                      Suggested Activities
                    </p>
                    <ul className="space-y-1.5">
                      {intervention.suggested_activities.map((activity: string, idx: number) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-sm text-zinc-400"
                        >
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex-shrink-0" />
                          {activity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {isExpanded && !intervention && (
              <div className="border-t border-white/[0.06] p-4 bg-zinc-900/30 text-sm text-zinc-500">
                No intervention recommendations available for this skill.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

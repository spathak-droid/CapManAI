"use client";

import type { StudentTierInfo } from "@/lib/types";

interface MTSSHeatmapProps {
  students: StudentTierInfo[];
}

const SKILL_LABELS: Record<string, string> = {
  price_action: "Price Action",
  options_chain: "Options Chain",
  strike_select: "Strike Selection",
  risk_mgmt: "Risk Mgmt",
  position_size: "Position Size",
  regime_id: "Regime ID",
  vol_assess: "Vol Assess",
  trade_mgmt: "Trade Mgmt",
};

function cellColor(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "bg-emerald-500/15 text-emerald-400";
    case "tier_2":
      return "bg-amber-500/15 text-amber-400";
    case "tier_3":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-zinc-800 text-zinc-500";
  }
}

function formatSkillName(key: string): string {
  return SKILL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MTSSHeatmap({ students }: MTSSHeatmapProps) {
  if (students.length === 0) return null;

  // Derive skill columns from the first student
  const skillKeys = Object.keys(students[0].skill_tiers);

  return (
    <div className="card-glow overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gradient-to-r from-violet-500/10 via-purple-500/5 to-transparent">
          <tr>
            <th className="sticky left-0 z-10 bg-zinc-900/90 backdrop-blur-sm px-3 sm:px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-400 min-w-[100px]">
              Student
            </th>
            <th className="px-3 sm:px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-400">
              Avg Score
            </th>
            {skillKeys.map((skill) => (
              <th
                key={skill}
                className="px-3 sm:px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-400 whitespace-nowrap"
              >
                {formatSkillName(skill)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr
              key={student.user_id}
              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              <td className="sticky left-0 bg-zinc-900 px-3 sm:px-4 py-3 font-medium text-white whitespace-nowrap min-w-[100px]">
                {student.name || student.username}
              </td>
              <td className="px-3 sm:px-4 py-3 text-center font-mono text-blue-400">
                {student.avg_score.toFixed(1)}
              </td>
              {skillKeys.map((skill) => {
                const tier = student.skill_tiers[skill] ?? "";
                return (
                  <td
                    key={skill}
                    className="px-3 sm:px-4 py-3 text-center"
                    title={`${student.name || student.username} / ${formatSkillName(skill)}: ${tier.replace("_", " ")}`}
                  >
                    <span
                      className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold transition-shadow hover:shadow-[0_0_8px_rgba(139,92,246,0.15)] ${cellColor(tier)}`}
                    >
                      {tier.replace("tier_", "T")}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

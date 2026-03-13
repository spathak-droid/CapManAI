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
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-800/50">
          <tr>
            <th className="sticky left-0 z-10 bg-zinc-800/50 px-4 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
              Student
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
              Avg Score
            </th>
            {skillKeys.map((skill) => (
              <th
                key={skill}
                className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-zinc-500"
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
              <td className="sticky left-0 bg-zinc-900 px-4 py-3 font-medium text-white">
                {student.username}
              </td>
              <td className="px-4 py-3 text-center font-mono text-blue-400">
                {student.avg_score.toFixed(1)}
              </td>
              {skillKeys.map((skill) => {
                const tier = student.skill_tiers[skill] ?? "";
                return (
                  <td
                    key={skill}
                    className="px-4 py-3 text-center"
                    title={`${student.username} / ${formatSkillName(skill)}: ${tier.replace("_", " ")}`}
                  >
                    <span
                      className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ${cellColor(tier)}`}
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

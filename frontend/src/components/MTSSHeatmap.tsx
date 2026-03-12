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
      return "bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100";
    case "tier_2":
      return "bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100";
    case "tier_3":
      return "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Student
            </th>
            <th className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">
              Avg Score
            </th>
            {skillKeys.map((skill) => (
              <th
                key={skill}
                className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300"
              >
                {formatSkillName(skill)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
          {students.map((student) => (
            <tr
              key={student.user_id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="sticky left-0 bg-white px-4 py-3 font-medium text-gray-900 dark:bg-gray-800 dark:text-white">
                {student.username}
              </td>
              <td className="px-4 py-3 text-center font-mono text-gray-900 dark:text-white">
                {student.avg_score.toFixed(1)}
              </td>
              {skillKeys.map((skill) => {
                const tier = student.skill_tiers[skill] ?? "";
                return (
                  <td
                    key={skill}
                    className={`px-4 py-3 text-center text-xs font-bold ${cellColor(tier)}`}
                    title={`${student.username} / ${formatSkillName(skill)}: ${tier.replace("_", " ")}`}
                  >
                    {tier.replace("tier_", "T")}
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

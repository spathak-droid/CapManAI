"use client";

import { useState } from "react";
import type { MTSSStudent, SkillScore } from "@/lib/types";

interface MTSSHeatmapProps {
  students: MTSSStudent[];
  skillNames: string[];
}

function tierColor(tier: 1 | 2 | 3) {
  switch (tier) {
    case 1:
      return "text-green-600 dark:text-green-400";
    case 2:
      return "text-yellow-600 dark:text-yellow-400";
    case 3:
      return "text-red-600 dark:text-red-400";
  }
}

function scoreCellColor(score: number, maxScore: number) {
  const pct = (score / maxScore) * 100;
  if (pct >= 70) return "bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100";
  if (pct >= 40) return "bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100";
  return "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100";
}

export default function MTSSHeatmap({ students, skillNames }: MTSSHeatmapProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function getSkillScore(skills: SkillScore[], skillName: string): SkillScore | undefined {
    return skills.find((s) => s.skill === skillName);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Student
            </th>
            <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
              Tier
            </th>
            {skillNames.map((skill) => (
              <th
                key={skill}
                className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300"
              >
                {skill}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
          {students.map((student) => (
            <>
              <tr
                key={student.user_id}
                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() =>
                  setExpandedId(
                    expandedId === student.user_id ? null : student.user_id,
                  )
                }
              >
                <td className="sticky left-0 bg-white px-4 py-3 font-medium text-gray-900 dark:bg-gray-800 dark:text-white">
                  {student.username}
                </td>
                <td className={`px-4 py-3 font-bold ${tierColor(student.tier)}`}>
                  T{student.tier}
                </td>
                {skillNames.map((skill) => {
                  const ss = getSkillScore(student.skills, skill);
                  if (!ss) {
                    return (
                      <td
                        key={skill}
                        className="px-4 py-3 text-center text-gray-400"
                      >
                        --
                      </td>
                    );
                  }
                  return (
                    <td
                      key={skill}
                      className={`px-4 py-3 text-center font-medium ${scoreCellColor(ss.score, ss.max_score)}`}
                      title={`${ss.score}/${ss.max_score} (${ss.attempts} attempts)`}
                    >
                      {Math.round((ss.score / ss.max_score) * 100)}%
                    </td>
                  );
                })}
              </tr>
              {expandedId === student.user_id && (
                <tr key={`${student.user_id}-expanded`}>
                  <td
                    colSpan={skillNames.length + 2}
                    className="bg-gray-50 px-6 py-4 dark:bg-gray-700/30"
                  >
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">XP</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {student.xp.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Level</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {student.level}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tier</p>
                        <p className={`text-lg font-bold ${tierColor(student.tier)}`}>
                          Tier {student.tier}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Skills Tracked</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                          {student.skills.length}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

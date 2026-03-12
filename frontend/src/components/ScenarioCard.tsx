"use client";

import type { Scenario } from "@/lib/types";

interface ScenarioCardProps {
  scenario: Scenario;
}

export default function ScenarioCard({ scenario }: ScenarioCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {scenario.topic}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            scenario.difficulty === "beginner"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : scenario.difficulty === "intermediate"
                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          }`}
        >
          {scenario.difficulty}
        </span>
      </div>

      {/* Situation */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        Scenario
      </h3>
      <p className="mb-6 leading-relaxed text-gray-700 dark:text-gray-300">
        {scenario.situation}
      </p>

      {/* Market Data Table */}
      {scenario.market_data.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Market Data
          </h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Asset
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Price
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Change
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Volume
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    High
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                    Low
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {scenario.market_data.map((md) => (
                  <tr
                    key={md.asset}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {md.asset}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      ${md.price.toLocaleString()}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        md.change_percent >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {md.change_percent >= 0 ? "+" : ""}
                      {md.change_percent.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {md.volume}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      ${md.high.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      ${md.low.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Question */}
      <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/30">
        <h4 className="mb-1 text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          Your Task
        </h4>
        <p className="font-medium text-gray-900 dark:text-white">
          {scenario.question}
        </p>
      </div>
    </div>
  );
}

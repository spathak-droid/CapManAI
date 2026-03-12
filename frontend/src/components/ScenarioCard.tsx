"use client";

import type { Scenario } from "@/lib/types";

interface ScenarioCardProps {
  scenario: Scenario;
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">N/A</span>;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-gray-400 italic">Empty</span>;

    // If array of primitives, join them
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return value.map(String).join(", ");
    }

    // Array of objects — render each as a sub-table
    return (
      <div className="space-y-2">
        {value.map((item, idx) => (
          <div
            key={idx}
            className="rounded border border-gray-200 p-2 dark:border-gray-600"
          >
            {typeof item === "object" && item !== null ? (
              <MarketDataTable data={item as Record<string, unknown>} nested />
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === "object") {
    return (
      <MarketDataTable data={value as Record<string, unknown>} nested />
    );
  }

  return String(value);
}

function MarketDataTable({
  data,
  nested = false,
}: {
  data: Record<string, unknown>;
  nested?: boolean;
}) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;

  return (
    <div
      className={`overflow-x-auto ${nested ? "" : "rounded-lg border border-gray-200 dark:border-gray-600"}`}
    >
      <table className="w-full text-left text-sm">
        <tbody
          className={`divide-y divide-gray-200 dark:divide-gray-600 ${nested ? "" : "bg-white dark:bg-gray-800"}`}
        >
          {entries.map(([key, val]) => (
            <tr
              key={key}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-600 dark:text-gray-400">
                {formatKey(key)}
              </td>
              <td className="px-4 py-2 text-gray-900 dark:text-white">
                {renderValue(val)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ScenarioCard({ scenario }: ScenarioCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Situation */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
        Scenario
      </h3>
      <p className="mb-6 leading-relaxed text-gray-700 dark:text-gray-300">
        {scenario.situation}
      </p>

      {/* Market Data Table */}
      {Object.keys(scenario.market_data).length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Market Data
          </h4>
          <MarketDataTable data={scenario.market_data} />
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

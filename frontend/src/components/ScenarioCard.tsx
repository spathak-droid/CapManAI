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
    return <span className="text-zinc-600 italic">N/A</span>;
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
    if (value.length === 0) return <span className="text-zinc-600 italic">Empty</span>;

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
            className="rounded-lg border border-white/[0.06] p-2"
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
      className={`overflow-x-auto ${nested ? "ml-2" : "rounded-xl border border-white/[0.06] overflow-hidden"}`}
    >
      <table className="w-full text-left text-sm">
        <tbody>
          {entries.map(([key, val]) => (
            <tr
              key={key}
              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
            >
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-zinc-400">
                {formatKey(key)}
              </td>
              <td className="px-4 py-2.5 text-white">
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
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-6">
      {/* Situation */}
      <h3 className="mb-2 text-lg font-semibold text-white">
        Scenario
      </h3>
      <p className="mb-6 leading-relaxed text-zinc-300">
        {scenario.situation}
      </p>

      {/* Market Data Table */}
      {Object.keys(scenario.market_data).length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Market Data
          </h4>
          <MarketDataTable data={scenario.market_data} />
        </div>
      )}

      {/* Question */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <h4 className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-400">
          Your Task
        </h4>
        <p className="font-medium text-white">
          {scenario.question}
        </p>
      </div>
    </div>
  );
}

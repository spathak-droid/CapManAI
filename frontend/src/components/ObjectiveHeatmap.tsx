"use client";

import type { ObjectiveDistribution } from "@/lib/types";

interface ObjectiveHeatmapProps {
  objectives: ObjectiveDistribution[];
}

export default function ObjectiveHeatmap({ objectives }: ObjectiveHeatmapProps) {
  if (objectives.length === 0) {
    return (
      <div className="card-glow p-10 text-center text-zinc-500">
        No objective data available yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {objectives.map((obj) => {
        const total = obj.total_students || 1;
        const t1Pct = Math.round((obj.tier_1_count / total) * 100);
        const t2Pct = Math.round((obj.tier_2_count / total) * 100);
        const t3Pct = Math.round((obj.tier_3_count / total) * 100);

        return (
          <div
            key={obj.objective_id}
            className="card-glow p-5 flex flex-col gap-3"
          >
            <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2">
              {obj.objective_name}
            </h3>

            <p className="text-xs text-zinc-500">
              {obj.total_students} student{obj.total_students !== 1 ? "s" : ""}
            </p>

            {/* Stacked bar */}
            <div className="h-5 rounded-full overflow-hidden flex bg-zinc-800">
              {obj.tier_1_count > 0 && (
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${t1Pct}%` }}
                  title={`Tier 1: ${obj.tier_1_count}`}
                />
              )}
              {obj.tier_2_count > 0 && (
                <div
                  className="bg-yellow-500 transition-all"
                  style={{ width: `${t2Pct}%` }}
                  title={`Tier 2: ${obj.tier_2_count}`}
                />
              )}
              {obj.tier_3_count > 0 && (
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${t3Pct}%` }}
                  title={`Tier 3: ${obj.tier_3_count}`}
                />
              )}
            </div>

            {/* Tier counts legend */}
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1 text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                {obj.tier_1_count}
              </span>
              <span className="flex items-center gap-1 text-yellow-400">
                <span className="h-2 w-2 rounded-full bg-yellow-500 inline-block" />
                {obj.tier_2_count}
              </span>
              <span className="flex items-center gap-1 text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                {obj.tier_3_count}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

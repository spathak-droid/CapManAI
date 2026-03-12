"use client";

import { useEffect, useState } from "react";
import type { Grade } from "@/lib/types";

interface GradeDisplayProps {
  grade: Grade;
}

export default function GradeDisplay({ grade }: GradeDisplayProps) {
  const [showXp, setShowXp] = useState(false);
  const [animatedXp, setAnimatedXp] = useState(0);

  useEffect(() => {
    // Trigger XP animation after a short delay
    const timer = setTimeout(() => setShowXp(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showXp) return;
    const target = grade.xp_earned;
    const duration = 1000;
    const start = performance.now();

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setAnimatedXp(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [showXp, grade.xp_earned]);

  function scoreColor(score: number, max: number) {
    const pct = score / max;
    if (pct >= 0.8) return "bg-green-500";
    if (pct >= 0.6) return "bg-blue-500";
    if (pct >= 0.4) return "bg-yellow-500";
    return "bg-red-500";
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Overall Score and XP */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Overall Score
          </p>
          <p className="text-5xl font-bold text-gray-900 dark:text-white">
            {grade.overall_score}
            <span className="text-2xl text-gray-400">/20</span>
          </p>
        </div>
        <div
          className={`text-center transition-all duration-500 ${showXp ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
        >
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            XP Earned
          </p>
          <p className="text-4xl font-bold text-green-600 dark:text-green-400">
            +{animatedXp}
          </p>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="mb-6 space-y-4">
        <h4 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Score Breakdown
        </h4>
        {grade.dimensions.map((dim) => (
          <div key={dim.name}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {dim.name}
              </span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {dim.score}/{dim.max_score}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2.5 rounded-full transition-all duration-700 ${scoreColor(dim.score, dim.max_score)}`}
                style={{
                  width: `${(dim.score / dim.max_score) * 100}%`,
                }}
              />
            </div>
            {dim.feedback && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {dim.feedback}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Overall Feedback */}
      <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-700/50">
        <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Feedback
        </h4>
        <p className="leading-relaxed text-gray-600 dark:text-gray-300">
          {grade.feedback}
        </p>
      </div>
    </div>
  );
}

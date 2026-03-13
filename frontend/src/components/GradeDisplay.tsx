"use client";

import { useEffect, useState } from "react";
import type { Grade } from "@/lib/types";

interface GradeDisplayProps {
  grade: Grade;
}

const DIMENSIONS: { key: keyof Grade; label: string }[] = [
  { key: "technical_accuracy", label: "Technical Accuracy" },
  { key: "risk_awareness", label: "Risk Awareness" },
  { key: "strategy_fit", label: "Strategy Fit" },
  { key: "reasoning_clarity", label: "Reasoning Clarity" },
];

export default function GradeDisplay({ grade }: GradeDisplayProps) {
  const [showXp, setShowXp] = useState(false);
  const [animatedXp, setAnimatedXp] = useState(0);

  useEffect(() => {
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
      const eased = 1 - (1 - progress) * (1 - progress);
      setAnimatedXp(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [showXp, grade.xp_earned]);

  function scoreColor(score: number) {
    const pct = score / 5;
    if (pct >= 0.8) return "bg-emerald-500";
    if (pct >= 0.6) return "bg-blue-500";
    if (pct >= 0.4) return "bg-amber-500";
    return "bg-red-500";
  }

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-6">
      {/* Overall Score and XP */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Overall Score
          </p>
          <p className="text-5xl font-bold text-white">
            {grade.overall_score.toFixed(1)}
            <span className="text-2xl text-zinc-600">/5</span>
          </p>
        </div>
        <div
          className={`text-center transition-all duration-500 ${showXp ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            XP Earned
          </p>
          <p className="text-4xl font-bold text-emerald-400">
            +{animatedXp}
          </p>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="mb-6 space-y-4">
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Score Breakdown
        </h4>
        {DIMENSIONS.map((dim) => {
          const score = grade[dim.key] as number;
          return (
            <div key={dim.key}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm text-zinc-300">
                  {dim.label}
                </span>
                <span className="text-sm font-medium text-white">
                  {score.toFixed(1)}/5
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-800">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${scoreColor(score)}`}
                  style={{ width: `${(score / 5) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Feedback */}
      <div className="rounded-xl border border-white/[0.06] bg-zinc-800/50 p-4">
        <h4 className="mb-2 text-sm font-medium text-zinc-400">
          Feedback
        </h4>
        <p className="leading-relaxed text-zinc-300">
          {grade.feedback_text}
        </p>
      </div>
    </div>
  );
}

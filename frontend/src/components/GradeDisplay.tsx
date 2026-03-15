"use client";

import { useEffect, useRef } from "react";
import type { Grade } from "@/lib/types";
import { useCountUp, useProgressFill, useScrollReveal, gsap } from "@/lib/gsap";

interface GradeDisplayProps {
  grade: Grade;
}

const DIMENSIONS: { key: keyof Grade; label: string }[] = [
  { key: "technical_accuracy", label: "Technical Accuracy" },
  { key: "risk_awareness", label: "Risk Awareness" },
  { key: "strategy_fit", label: "Strategy Fit" },
  { key: "reasoning_clarity", label: "Reasoning Clarity" },
];

/** Individual dimension bar so each can use its own useProgressFill hook */
function DimensionBar({ score, index }: { score: number; index: number }) {
  const pct = (score / 5) * 100;
  function scoreColor(s: number) {
    const p = s / 5;
    if (p >= 0.8) return "bg-emerald-500";
    if (p >= 0.6) return "bg-blue-500";
    if (p >= 0.4) return "bg-amber-500";
    return "bg-red-500";
  }
  const barRef = useProgressFill<HTMLDivElement>(pct, { delay: index * 0.1 });
  return (
    <div
      ref={barRef}
      className={`h-2 rounded-full ${scoreColor(score)}`}
    />
  );
}

export default function GradeDisplay({ grade }: GradeDisplayProps) {
  // Count up for overall score, displaying 1 decimal
  const scoreRef = useCountUp(grade.overall_score, { duration: 1.2, delay: 0.2 });

  // Override the default integer rounding with 1-decimal formatting
  useEffect(() => {
    const el = scoreRef.current;
    if (!el) return;
    // After the countUp animation finishes, the onUpdate in useCountUp uses Math.round.
    // We patch by observing mutations, but simpler: run our own tween that writes toFixed(1).
    const obj = { value: 0 };
    const tween = gsap.to(obj, {
      value: grade.overall_score,
      duration: 1.2,
      delay: 0.2,
      ease: "power2.out",
      onUpdate() {
        el.textContent = obj.value.toFixed(1);
      },
    });
    return () => { tween.kill(); };
  }, [grade.overall_score, scoreRef]);

  // XP bounce animation
  const xpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = xpRef.current;
    if (!el) return;
    gsap.set(el, { scale: 0 });
    const tween = gsap.to(el, {
      scale: 1,
      duration: 0.6,
      delay: 0.3,
      ease: "back.out(1.7)",
    });
    return () => { tween.kill(); };
  }, []);

  // Animated XP count
  const xpCountRef = useCountUp(grade.xp_earned, { duration: 1, delay: 0.5 });

  // Feedback box scroll reveal
  const feedbackRef = useScrollReveal<HTMLDivElement>({ y: 20, duration: 0.5, delay: 0.4 });

  return (
    <div className="card-glow p-6">
      {/* Overall Score and XP */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Overall Score
          </p>
          <p className="text-5xl font-bold text-white">
            <span ref={scoreRef}>0</span>
            <span className="text-2xl text-zinc-600">/5</span>
          </p>
        </div>
        <div ref={xpRef} className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            XP Earned
          </p>
          <p className="text-4xl font-bold text-emerald-400">
            +<span ref={xpCountRef}>0</span>
          </p>
        </div>
      </div>

      {/* Dimension Scores */}
      <div className="mb-6 space-y-4">
        <h4 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Score Breakdown
        </h4>
        {DIMENSIONS.map((dim, index) => {
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
                <DimensionBar score={score} index={index} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall Feedback */}
      <div ref={feedbackRef} className="rounded-xl border border-white/[0.06] bg-zinc-800/50 p-4">
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

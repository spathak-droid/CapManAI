"use client";

import Link from "next/link";
import type { ChallengeResultDetail, QuizQuestion } from "@/lib/types";

interface ChallengeResultProps {
  result: ChallengeResultDetail;
  currentUserId: number;
}

const GRADE_DIMENSIONS = [
  { key: "technical_accuracy", label: "Technical Accuracy" },
  { key: "risk_awareness", label: "Risk Awareness" },
  { key: "strategy_fit", label: "Strategy Fit" },
  { key: "reasoning_clarity", label: "Reasoning Clarity" },
  { key: "overall_score", label: "Overall Score" },
];

function GradeCard({
  title,
  grade,
  isWinner,
}: {
  title: string;
  grade: Record<string, unknown> | null;
  isWinner: boolean;
}) {
  return (
    <div
      className={`flex-1 rounded-2xl border p-5 ${
        isWinner
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            isWinner
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {isWinner ? "Winner" : "Runner-up"}
        </span>
        <span className="text-sm font-medium text-white">{title}</span>
      </div>

      {grade ? (
        <div className="space-y-3">
          {GRADE_DIMENSIONS.map((dim) => {
            const value = grade[dim.key];
            const numValue = typeof value === "number" ? value : 0;
            const pct = Math.min(numValue * 10, 100);
            return (
              <div key={dim.key}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{dim.label}</span>
                  <span className="text-xs font-mono text-zinc-300">
                    {typeof value === "number" ? value.toFixed(1) : "--"}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      isWinner
                        ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                        : "bg-gradient-to-r from-red-500 to-red-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No grade data available</p>
      )}
    </div>
  );
}

function QuizResultCard({
  title,
  questions,
  answers,
  isWinner,
}: {
  title: string;
  questions: QuizQuestion[];
  answers: { question_id: number; selected: string }[];
  isWinner: boolean;
}) {
  const answerMap = Object.fromEntries(answers.map((a) => [a.question_id, a.selected]));
  const correct = questions.filter((q) => answerMap[q.id] === q.correct_option_id).length;

  return (
    <div
      className={`flex-1 rounded-2xl border p-5 ${
        isWinner
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              isWinner
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-red-500/20 text-red-400"
            }`}
          >
            {isWinner ? "Winner" : "Runner-up"}
          </span>
          <span className="text-sm font-medium text-white">{title}</span>
        </div>
        <span
          className={`text-lg font-bold font-mono ${
            isWinner ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {correct}/3
        </span>
      </div>
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const userAnswer = answerMap[q.id];
          const isCorrect = userAnswer === q.correct_option_id;
          return (
            <div key={q.id} className="space-y-2">
              <p className="text-xs text-zinc-400">
                <span className="text-zinc-500 mr-1">Q{idx + 1}.</span>
                {q.prompt}
              </p>
              <div className="flex items-center gap-2 text-xs">
                {isCorrect ? (
                  <span className="text-emerald-400">✓ Correct</span>
                ) : (
                  <span className="text-red-400">
                    ✗ Answered: {userAnswer?.toUpperCase()}, Correct:{" "}
                    {q.correct_option_id?.toUpperCase()}
                  </span>
                )}
              </div>
              {q.explanation && !isCorrect && (
                <p className="text-xs text-zinc-500 italic">{q.explanation}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChallengeResult({
  result,
  currentUserId,
}: ChallengeResultProps) {
  const isWinner = result.winner_id === currentUserId;
  const isDraw = result.winner_id === null;

  return (
    <div className="space-y-6">
      {/* Winner banner */}
      <div
        className={`rounded-2xl border p-6 text-center ${
          isDraw
            ? "border-amber-500/30 bg-amber-500/5"
            : isWinner
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/20 bg-red-500/5"
        }`}
      >
        <h2
          className={`text-2xl font-bold ${
            isDraw
              ? "text-amber-400"
              : isWinner
                ? "text-emerald-400"
                : "text-red-400"
          }`}
        >
          {isDraw ? "Draw!" : isWinner ? "Victory!" : "Defeat"}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          {isDraw
            ? "Both players performed equally well"
            : isWinner
              ? "Congratulations on your win!"
              : "Better luck next time!"}
        </p>
        {result.xp_earned > 0 && (
          <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-3 py-1 text-sm font-medium text-violet-400 ring-1 ring-violet-500/20">
            +{result.xp_earned} XP earned
          </p>
        )}
      </div>

      {/* Side-by-side grades / quiz results */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {result.quiz_questions &&
        result.quiz_questions.length > 0 &&
        result.challenger_answers &&
        result.opponent_answers ? (
          <>
            <QuizResultCard
              title="Your Score"
              questions={result.quiz_questions}
              answers={result.challenger_answers}
              isWinner={isWinner || isDraw}
            />
            <QuizResultCard
              title="Opponent Score"
              questions={result.quiz_questions}
              answers={result.opponent_answers}
              isWinner={!isWinner && !isDraw}
            />
          </>
        ) : (
          <>
            <GradeCard
              title="Your Score"
              grade={result.challenger_grade}
              isWinner={isWinner || isDraw}
            />
            <GradeCard
              title="Opponent Score"
              grade={result.opponent_grade}
              isWinner={!isWinner && !isDraw}
            />
          </>
        )}
      </div>

      {/* Back button */}
      <div className="text-center">
        <Link
          href="/challenges"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-800/60 px-6 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700/60 hover:text-white hover:border-white/[0.15]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to Challenges
        </Link>
      </div>
    </div>
  );
}

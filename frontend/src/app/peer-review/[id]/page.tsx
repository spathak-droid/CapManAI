"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { getAssignmentDetail, submitPeerReview } from "@/lib/api";
import type { PeerReviewAssignmentDetail } from "@/lib/types";

const RUBRIC_ITEMS = [
  {
    key: "technical_accuracy" as const,
    label: "Technical Accuracy",
    description: "Correctness of market analysis and instrument knowledge",
  },
  {
    key: "risk_awareness" as const,
    label: "Risk Awareness",
    description: "Identification and management of risk factors",
  },
  {
    key: "strategy_fit" as const,
    label: "Strategy Fit",
    description: "How well the strategy matches the market conditions",
  },
  {
    key: "reasoning_clarity" as const,
    label: "Reasoning Clarity",
    description: "Clear, logical explanation of the decision process",
  },
];

type ScoreKeys =
  | "technical_accuracy"
  | "risk_awareness"
  | "strategy_fit"
  | "reasoning_clarity";

export default function PeerReviewFormPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = Number(params.id);

  const { data: detail, error, isLoading } = useSWR<PeerReviewAssignmentDetail>(
    assignmentId ? `peer-review-assignment-${assignmentId}` : null,
    () => getAssignmentDetail(assignmentId),
    { revalidateOnFocus: false },
  );

  const [scores, setScores] = useState<Record<ScoreKeys, number>>({
    technical_accuracy: 3,
    risk_awareness: 3,
    strategy_fit: 3,
    reasoning_clarity: 3,
  });
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (feedback.length < 10) {
      setSubmitError("Feedback must be at least 10 characters.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitPeerReview(assignmentId, {
        ...scores,
        feedback_text: feedback,
      });
      // Invalidate peer review caches so the list page shows fresh data
      await Promise.all([
        mutate("peer-review-assignments"),
        mutate("peer-review-received"),
      ]);
      setSubmitted(true);
      setTimeout(() => router.push("/peer-review"), 2000);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit review",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-white/[0.06] bg-zinc-800/50"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error instanceof Error ? error.message : "Failed to load assignment"}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-8 text-center">
          <div className="mb-2 text-2xl">&#10003;</div>
          <h2 className="text-lg font-semibold text-emerald-400">
            Review Submitted
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            You earned 15 XP for this review. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  const alreadySubmitted = detail?.status === "submitted";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        Peer Review
      </h1>
      <p className="mb-8 text-zinc-500">
        Review Assignment #{assignmentId}
      </p>

      {/* Context: Scenario + Response */}
      {detail?.scenario_situation && (
        <div className="mb-6 rounded-xl border border-white/[0.06] bg-zinc-800/30 p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Scenario
          </h3>
          <p className="text-sm leading-relaxed text-zinc-300">
            {detail.scenario_situation}
          </p>
          {detail.scenario_question && (
            <p className="mt-3 text-sm font-medium text-violet-300">
              {detail.scenario_question}
            </p>
          )}
        </div>
      )}

      {detail?.answer_text && (
        <div className="mb-8 rounded-xl border border-blue-500/10 bg-blue-500/[0.03] p-5">
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Student Response
          </h3>
          <p className="text-sm leading-relaxed text-zinc-300">
            {detail.answer_text}
          </p>
        </div>
      )}

      {alreadySubmitted ? (
        <div className="rounded-xl border border-zinc-500/20 bg-zinc-800/30 p-8 text-center text-zinc-400">
          This review has already been submitted.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rubric sliders */}
          {RUBRIC_ITEMS.map((item) => (
            <div key={item.key}>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-white">
                    {item.label}
                  </label>
                  <p className="text-xs text-zinc-500">{item.description}</p>
                </div>
                <span className="font-mono text-lg font-bold text-violet-400">
                  {scores[item.key].toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={0.5}
                value={scores[item.key]}
                onChange={(e) =>
                  setScores((prev) => ({
                    ...prev,
                    [item.key]: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-violet-500"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          ))}

          {/* Feedback textarea */}
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              Feedback
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={5}
              placeholder="Provide constructive feedback (min 10 characters)..."
              className="w-full rounded-xl border border-white/[0.08] bg-zinc-800/50 p-4 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30"
            />
            {feedback.length > 0 && feedback.length < 10 && (
              <p className="mt-1 text-xs text-red-400">
                {10 - feedback.length} more characters needed
              </p>
            )}
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {submitError}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || feedback.length < 10}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-600 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition-all hover:shadow-violet-500/30 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Review"}
          </button>
        </form>
      )}
    </div>
  );
}

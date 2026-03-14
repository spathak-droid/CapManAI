"use client";

import { useState } from "react";
import Link from "next/link";
import { usePeerReviewAssignments, useReceivedReviews } from "@/lib/hooks";
import { rateHelpfulness } from "@/lib/api";
import type { PeerReviewDetail } from "@/lib/types";

type Tab = "to-review" | "received";

export default function PeerReviewPage() {
  const [activeTab, setActiveTab] = useState<Tab>("to-review");
  const {
    data: assignments,
    error: assignError,
    isLoading: assignLoading,
  } = usePeerReviewAssignments();
  const {
    data: reviews,
    error: reviewError,
    isLoading: reviewLoading,
    mutate: mutateReviews,
  } = useReceivedReviews();

  const isLoading = activeTab === "to-review" ? assignLoading : reviewLoading;
  const error = activeTab === "to-review" ? assignError : reviewError;

  async function handleRate(review: PeerReviewDetail, rating: number) {
    try {
      await rateHelpfulness(review.id, rating);
      mutateReviews();
    } catch {
      // ignore
    }
  }

  function scoreColor(score: number): string {
    if (score >= 4) return "text-emerald-400";
    if (score >= 3) return "text-yellow-400";
    return "text-red-400";
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        Peer Review
      </h1>
      <p className="mb-6 text-zinc-500">
        Review your peers&apos; responses and receive feedback on your own work.
      </p>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(
          [
            { key: "to-review" as Tab, label: "To Review" },
            { key: "received" as Tab, label: "Received" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              activeTab === tab.key
                ? "bg-purple-600 text-white shadow-lg shadow-purple-600/25"
                : "border border-zinc-700 text-zinc-400 hover:border-purple-500/50 hover:text-zinc-200"
            }`}
          >
            {tab.label}
            {tab.key === "to-review" && assignments && (
              <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                {assignments.filter((a) => a.status === "assigned").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-zinc-800/50"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error instanceof Error ? error.message : "Failed to load data"}
        </div>
      )}

      {/* To Review tab */}
      {!isLoading && !error && activeTab === "to-review" && (
        <div className="space-y-3">
          {(assignments ?? []).length === 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-800/30 p-8 text-center text-zinc-500">
              No review assignments yet. Complete scenarios to start receiving
              peer reviews to do.
            </div>
          )}
          {(assignments ?? []).map((assignment) => (
            <Link
              key={assignment.id}
              href={`/peer-review/${assignment.id}`}
              className="block rounded-xl border border-white/[0.06] bg-zinc-800/30 p-4 transition-all hover:border-purple-500/30 hover:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    Review Assignment #{assignment.id}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Response #{assignment.response_id} &middot; Created{" "}
                    {new Date(assignment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    assignment.status === "assigned"
                      ? "bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20"
                      : assignment.status === "submitted"
                        ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                        : "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20"
                  }`}
                >
                  {assignment.status}
                </span>
              </div>
              {assignment.due_at && (
                <p className="mt-2 text-xs text-zinc-500">
                  Due: {new Date(assignment.due_at).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Received tab */}
      {!isLoading && !error && activeTab === "received" && (
        <div className="space-y-4">
          {(reviews ?? []).length === 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-zinc-800/30 p-8 text-center text-zinc-500">
              No reviews received yet. Submit scenario responses to get peer
              feedback.
            </div>
          )}
          {(reviews ?? []).map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-white/[0.06] bg-zinc-800/30 p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-white">
                  Review #{review.id}
                </p>
                <span
                  className={`font-mono text-lg font-bold ${scoreColor(review.overall_score)}`}
                >
                  {review.overall_score.toFixed(1)}
                </span>
              </div>

              {/* Score breakdown */}
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["Technical", review.technical_accuracy],
                    ["Risk", review.risk_awareness],
                    ["Strategy", review.strategy_fit],
                    ["Reasoning", review.reasoning_clarity],
                  ] as const
                ).map(([label, score]) => (
                  <div
                    key={label}
                    className="rounded-lg bg-white/[0.03] p-2 text-center"
                  >
                    <p className="text-xs text-zinc-500">{label}</p>
                    <p
                      className={`font-mono text-sm font-semibold ${scoreColor(score)}`}
                    >
                      {score.toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Feedback */}
              <p className="mb-3 text-sm text-zinc-300">
                {review.feedback_text}
              </p>

              {/* Helpfulness rating */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">
                  Was this helpful?
                </span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(review, star)}
                    className={`text-lg transition-colors ${
                      review.helpfulness_rating &&
                      star <= review.helpfulness_rating
                        ? "text-yellow-400"
                        : "text-zinc-600 hover:text-yellow-400/50"
                    }`}
                    title={`Rate ${star}`}
                  >
                    &#9733;
                  </button>
                ))}
                {review.helpfulness_rating && (
                  <span className="text-xs text-zinc-500">
                    ({review.helpfulness_rating}/5)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

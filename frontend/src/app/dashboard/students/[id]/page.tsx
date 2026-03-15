"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentAnalysis } from "@/contexts/StudentAnalysisContext";
import { useStudentResponses, useStudentSkills, useStudentPeerReviews } from "@/lib/hooks";
import { submitEducatorFeedback } from "@/lib/api";
import type { StudentResponseEntry } from "@/lib/types";

const SKILL_LABELS: Record<string, string> = {
  price_action: "Price Action",
  options_chain: "Options Chain",
  strike_select: "Strike Selection",
  risk_mgmt: "Risk Management",
  position_size: "Position Sizing",
  regime_id: "Regime Identification",
  vol_assess: "Volatility Assessment",
  trade_mgmt: "Trade Management",
};

const TIER_BADGE: Record<string, string> = {
  tier_1: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  tier_2: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  tier_3: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function tierBadgeClass(tier: string): string {
  return TIER_BADGE[tier] ?? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "Tier 1";
    case "tier_2":
      return "Tier 2";
    case "tier_3":
      return "Tier 3";
    default:
      return tier;
  }
}

function formatSkillName(key: string): string {
  return SKILL_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score >= 4) return "text-emerald-400";
  if (score >= 3) return "text-amber-400";
  return "text-red-400";
}

function ResponseRow({
  response,
  onFeedbackSubmitted,
}: {
  response: StudentResponseEntry;
  onFeedbackSubmitted: (responseId: number, text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    setSubmitting(true);
    try {
      await submitEducatorFeedback(response.response_id, feedbackText.trim());
      onFeedbackSubmitted(response.response_id, feedbackText.trim());
      setSubmitted(true);
      setFeedbackText("");
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border-b border-white/[0.04]">
      {/* Summary row */}
      <div
        className="flex cursor-pointer items-center gap-3 sm:gap-4 px-3 sm:px-5 py-3.5 transition-all duration-200 hover:bg-violet-500/[0.04] hover:shadow-[inset_0_0_30px_rgba(139,92,246,0.03)]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-zinc-300 truncate">
            {response.scenario_situation || "No scenario text"}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {new Date(response.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {response.overall_score !== null && (
            <span
              className={`text-sm font-semibold tabular-nums ${scoreColor(response.overall_score)}`}
            >
              {response.overall_score.toFixed(1)}/5.0
            </span>
          )}
          {response.educator_feedback && !submitted && (
            <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-400 ring-1 ring-violet-500/20">
              Feedback
            </span>
          )}
          {submitted && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400 ring-1 ring-emerald-500/20">
              Sent
            </span>
          )}
          <svg
            className={`h-4 w-4 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-white/[0.04] bg-zinc-900/30 px-3 sm:px-5 py-4 space-y-4">
          {/* Student answer */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
              Student Response
            </p>
            <p className="text-sm text-zinc-300 whitespace-pre-wrap">
              {response.answer_text}
            </p>
          </div>

          {/* Probe exchanges */}
          {response.probe_exchanges && response.probe_exchanges.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
                Follow-Up Questions
              </p>
              <div className="space-y-2">
                {response.probe_exchanges.map((pe, idx) => (
                  <div key={idx} className="rounded-lg bg-zinc-800/50 p-3">
                    <p className="text-xs text-violet-400 font-medium mb-1">Q{idx + 1}: {pe.question}</p>
                    <p className="text-sm text-zinc-300">{pe.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grade breakdown */}
          {response.overall_score !== null && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
                AI Grade Breakdown
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Technical", value: response.technical_accuracy },
                  { label: "Risk", value: response.risk_awareness },
                  { label: "Strategy", value: response.strategy_fit },
                  { label: "Reasoning", value: response.reasoning_clarity },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-white/[0.06] bg-zinc-800/50 p-2.5 text-center transition-colors hover:border-white/[0.1]"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {item.label}
                    </p>
                    <p
                      className={`text-lg font-semibold tabular-nums ${scoreColor(item.value ?? null)}`}
                    >
                      {item.value?.toFixed(1) ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI feedback */}
          {response.grade_feedback && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1">
                AI Feedback
              </p>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap">
                {response.grade_feedback}
              </p>
            </div>
          )}

          {/* Existing educator feedback */}
          {response.educator_feedback && !submitted && (
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-violet-400 mb-1">
                Your Previous Feedback
              </p>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {response.educator_feedback}
              </p>
            </div>
          )}

          {/* Feedback form */}
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
              Leave Feedback
            </p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Write feedback for this student's response..."
              rows={3}
              className="w-full rounded-lg border border-white/[0.08] bg-zinc-800/50 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 resize-none"
            />
            <button
              onClick={handleSubmitFeedback}
              disabled={!feedbackText.trim() || submitting}
              className="btn-purple-solid mt-2 rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const userId = params.id ? Number(params.id) : null;

  const { setStudentContext, clearStudentContext } = useStudentAnalysis();
  const { data: skillData, isLoading: skillsLoading } = useStudentSkills(userId);
  const {
    data: responses,
    isLoading: responsesLoading,
    mutate: mutateResponses,
  } = useStudentResponses(userId);
  const { data: peerReviewData, isLoading: peerReviewsLoading } = useStudentPeerReviews(userId);

  useEffect(() => {
    if (skillData && userId) {
      setStudentContext(userId, skillData.name || skillData.username);
    }
    return () => {
      clearStudentContext();
    };
  }, [skillData, userId, setStudentContext, clearStudentContext]);

  useEffect(() => {
    if (!authLoading && user?.role !== "educator") {
      router.replace("/");
    }
  }, [authLoading, user?.role, router]);

  if (!authLoading && user?.role !== "educator") {
    return null;
  }

  const isLoading = skillsLoading || responsesLoading;

  // Compute overall tier from skills
  const skillEntries = skillData ? Object.entries(skillData.skills) : [];
  const avgScore =
    skillEntries.length > 0
      ? skillEntries.reduce((sum, [, s]) => sum + s.score, 0) / skillEntries.length
      : 0;
  const overallTier =
    avgScore >= 70 ? "tier_1" : avgScore >= 40 ? "tier_2" : "tier_3";

  const handleFeedbackSubmitted = (responseId: number, text: string) => {
    if (!responses) return;
    const updated = responses.map((r) =>
      r.response_id === responseId ? { ...r, educator_feedback: text } : r,
    );
    mutateResponses(updated, false);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/dashboard/students"
        className="mb-6 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Roster
      </Link>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-500">Loading student data...</div>
        </div>
      )}

      {/* Student Header */}
      {skillData && (
        <div className="card-glow relative mb-8 overflow-hidden p-6 animate-slide-up">
          {/* Grid overlay */}
          <div className="pointer-events-none absolute inset-0 bg-[image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white shadow-[0_0_20px_rgba(139,92,246,0.2)]"
              style={{
                background:
                  "linear-gradient(135deg, #3b82f6 0%, #7c3aed 50%, #a855f7 100%)",
              }}
            >
              {(skillData.name || skillData.username || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="gradient-text text-2xl sm:text-3xl font-bold truncate">
                {skillData.name || skillData.username}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(overallTier)}`}
                >
                  {tierLabel(overallTier)}
                </span>
                <span className="text-sm text-zinc-500">
                  Avg: {avgScore.toFixed(1)}
                </span>
              </div>
            </div>
            <Link
              href={`/dashboard/messages?student=${userId}` as Route}
              className="btn-purple-solid flex items-center justify-center gap-2 self-start rounded-lg px-4 py-2 text-sm font-medium"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
              Message Student
            </Link>
          </div>
        </div>
      )}

      {/* Skill Breakdown */}
      {skillData && skillEntries.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
            <span className="inline-block h-5 w-1 rounded-full bg-gradient-to-b from-blue-500 to-violet-500" />
            Skill Breakdown
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {skillEntries.map(([skillId, info], i) => {
              const tierColor = info.score >= 70 ? "emerald" : info.score >= 40 ? "amber" : "red";
              return (
                <div
                  key={skillId}
                  className={`card-glow p-4 animate-slide-up transition-shadow duration-300 hover:shadow-[0_0_20px_rgba(${tierColor === "emerald" ? "16,185,129" : tierColor === "amber" ? "245,158,11" : "239,68,68"},0.1)]`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium text-zinc-300">
                      {formatSkillName(skillId)}
                    </p>
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${tierBadgeClass(info.tier)}`}
                    >
                      {tierLabel(info.tier)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-end gap-1">
                      <span
                        className={`text-2xl font-bold tabular-nums ${
                          info.score >= 70
                            ? "text-emerald-400"
                            : info.score >= 40
                              ? "text-amber-400"
                              : "text-red-400"
                        }`}
                      >
                        {info.score.toFixed(1)}
                      </span>
                      <span className="mb-0.5 text-xs text-zinc-500">/100</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          info.score >= 70
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                            : info.score >= 40
                              ? "bg-gradient-to-r from-amber-600 to-amber-400"
                              : "bg-gradient-to-r from-red-600 to-red-400"
                        }`}
                        style={{ width: `${Math.min(100, info.score)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {info.attempts} attempt{info.attempts !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Responses */}
      {!responsesLoading && (
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
            <span className="inline-block h-5 w-1 rounded-full bg-gradient-to-b from-violet-500 to-purple-500" />
            Recent Responses
          </h2>
          {responses && responses.length > 0 ? (
            <div className="card-glow overflow-hidden">
              {responses.map((resp) => (
                <ResponseRow
                  key={resp.response_id}
                  response={resp}
                  onFeedbackSubmitted={handleFeedbackSubmitted}
                />
              ))}
            </div>
          ) : (
            <div className="card-glow p-10 text-center text-zinc-500">
              This student has not submitted any responses yet.
            </div>
          )}
        </div>
      )}

      {/* Peer Review Activity */}
      {!peerReviewsLoading && peerReviewData && (
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
            <span className="inline-block h-5 w-1 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
            Peer Review Activity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="card-glow p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Avg Score Given</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{peerReviewData.avg_score_given.toFixed(2)}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{peerReviewData.reviews_given.length} review{peerReviewData.reviews_given.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="card-glow p-4">
              <p className="text-xs uppercase tracking-wider text-zinc-500">Avg Score Received</p>
              <p className="text-2xl font-bold text-violet-400 mt-1">{peerReviewData.avg_score_received.toFixed(2)}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{peerReviewData.reviews_received.length} review{peerReviewData.reviews_received.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {peerReviewData.reviews_given.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Reviews Given</h3>
              <div className="card-glow overflow-hidden">
                {peerReviewData.reviews_given.map((r) => (
                  <div key={r.review_id} className="border-b border-white/[0.04] px-5 py-3.5 transition-colors duration-200 hover:bg-violet-500/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-[10px] font-bold text-white">
                          {(r.peer_name || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-zinc-200">{r.peer_name}</span>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${r.overall_score >= 4 ? "text-emerald-400" : r.overall_score >= 3 ? "text-amber-400" : "text-red-400"}`}>
                        {r.overall_score.toFixed(1)}/5.0
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 ml-[38px] line-clamp-2">{r.feedback_text}</p>
                    <p className="text-[10px] text-zinc-600 mt-1 ml-[38px]">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {peerReviewData.reviews_received.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-zinc-300 mb-3">Reviews Received</h3>
              <div className="card-glow overflow-hidden">
                {peerReviewData.reviews_received.map((r) => (
                  <div key={r.review_id} className="border-b border-white/[0.04] px-5 py-3.5 transition-colors duration-200 hover:bg-violet-500/[0.04]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-[10px] font-bold text-white">
                          {(r.peer_name || "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-zinc-200">{r.peer_name}</span>
                      </div>
                      <span className={`text-sm font-semibold tabular-nums ${r.overall_score >= 4 ? "text-emerald-400" : r.overall_score >= 3 ? "text-amber-400" : "text-red-400"}`}>
                        {r.overall_score.toFixed(1)}/5.0
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 ml-[38px] line-clamp-2">{r.feedback_text}</p>
                    <div className="flex items-center gap-2 mt-1 ml-[38px]">
                      <p className="text-[10px] text-zinc-600">{new Date(r.created_at).toLocaleDateString()}</p>
                      {r.helpfulness_rating && (
                        <span className="text-[10px] text-amber-400">{"★".repeat(r.helpfulness_rating)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {peerReviewData.reviews_given.length === 0 && peerReviewData.reviews_received.length === 0 && (
            <div className="card-glow p-10 text-center text-zinc-500">
              No peer review activity yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

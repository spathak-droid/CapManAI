"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeEvent } from "@/lib/useRealtimeEvent";
import MatchmakingSpinner from "@/components/MatchmakingSpinner";
import {
  joinQueue,
  leaveQueue,
  getQueueStatus,
  getMyChallenges,
  getChallengeResult,
} from "@/lib/api";
import type {
  ChallengeDetail,
  ChallengeResultDetail,
  QueueStatusResponse,
} from "@/lib/types";

const SKILL_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Any Skill" },
  { value: "price_action", label: "Price Action" },
  { value: "options_chain", label: "Options Chain" },
  { value: "strike_select", label: "Strike Selection" },
  { value: "risk_mgmt", label: "Risk Management" },
  { value: "position_size", label: "Position Sizing" },
  { value: "regime_id", label: "Regime Identification" },
  { value: "vol_assess", label: "Volatility Assessment" },
  { value: "trade_mgmt", label: "Trade Management" },
];

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-400 ring-amber-500/20";
    case "active":
      return "bg-blue-500/10 text-blue-400 ring-blue-500/20";
    case "submitted":
      return "bg-violet-500/10 text-violet-400 ring-violet-500/20";
    case "grading":
      return "bg-fuchsia-500/10 text-fuchsia-400 ring-fuchsia-500/20";
    case "complete":
      return "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20";
  }
}

export default function ChallengesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [skillTarget, setSkillTarget] = useState("");
  const [inQueue, setInQueue] = useState(false);
  const [queuedAt, setQueuedAt] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<ChallengeDetail[]>([]);
  const [selectedResult, setSelectedResult] =
    useState<ChallengeResultDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load queue status and challenges on mount
  useEffect(() => {
    async function load() {
      try {
        const [qStatus, myChallenges] = await Promise.all([
          getQueueStatus(),
          getMyChallenges(),
        ]);
        setInQueue(qStatus.in_queue);
        setQueuedAt(qStatus.queued_at);
        setChallenges(myChallenges);
      } catch {
        // Silently fail — user might not be authenticated yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Listen for match found — redirect to challenge page
  useRealtimeEvent(
    "challenge_matched",
    useCallback(
      (data: unknown) => {
        const event = data as { challenge_id: number };
        setInQueue(false);
        router.push(`/challenges/${event.challenge_id}`);
      },
      [router],
    ),
  );

  async function handleJoinQueue() {
    setError(null);
    try {
      await joinQueue(skillTarget || undefined);
      setInQueue(true);
      setQueuedAt(new Date().toISOString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to join matchmaking",
      );
    }
  }

  async function handleLeaveQueue() {
    setError(null);
    try {
      await leaveQueue();
      setInQueue(false);
      setQueuedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to leave queue");
    }
  }

  async function handleViewResult(challengeId: number) {
    setError(null);
    try {
      const result = await getChallengeResult(challengeId);
      setSelectedResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load result",
      );
    }
  }

  const activeChallenges = challenges.filter(
    (c) => c.status !== "complete",
  );
  const completedChallenges = challenges.filter(
    (c) => c.status === "complete",
  );

  const selectClass =
    "w-full bg-zinc-800/60 border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 appearance-none cursor-pointer transition-colors hover:border-white/[0.18]";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero header */}
      <div className="mb-10 relative">
        <div
          className="absolute -left-2 top-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl"
          aria-hidden
        />
        <h1 className="relative bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Head-to-Head Challenges
        </h1>
        <p className="mt-3 text-base text-zinc-400 max-w-xl">
          Compete against other traders in real-time. Match up, analyze the same
          scenario, and see who scores higher.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Result Modal */}
      {selectedResult && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/[0.08] bg-zinc-900/95 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                Challenge Result
              </h3>
              <button
                onClick={() => setSelectedResult(null)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Inline result display */}
            <ResultInline result={selectedResult} currentUserId={user.id} />
          </div>
        </div>
      )}

      {/* Queue Section */}
      {inQueue ? (
        <MatchmakingSpinner onCancel={handleLeaveQueue} queuedAt={queuedAt} />
      ) : (
        !loading && (
          <div className="mb-10 space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-zinc-900/80 p-6 shadow-[0_0_32px_rgba(139,92,246,0.08)]">
              <div
                className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-violet-500/10 blur-3xl"
                aria-hidden
              />
              <div className="relative space-y-4">
                <div className="max-w-xs">
                  <label className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                        />
                      </svg>
                    </span>
                    Skill Target
                  </label>
                  <select
                    value={skillTarget}
                    onChange={(e) => setSkillTarget(e.target.value)}
                    className={selectClass}
                  >
                    {SKILL_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleJoinQueue}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-fuchsia-700 px-6 py-4 text-lg font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:shadow-[0_0_40px_rgba(139,92,246,0.35)] hover:scale-[1.01] active:scale-[0.99]"
                >
                  <span
                    className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.15),transparent)]"
                    aria-hidden
                  />
                  <span className="relative flex items-center justify-center gap-3">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    Find a Match
                  </span>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Active Challenges */}
      {activeChallenges.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Active Challenges
          </h2>
          <div className="space-y-3">
            {activeChallenges.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/challenges/${c.id}`)}
                className="w-full rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4 text-left transition-all hover:border-violet-500/30 hover:bg-zinc-800/60 hover:shadow-[0_0_20px_rgba(139,92,246,0.08)]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">
                      <svg
                        className="h-5 w-5 text-violet-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Challenge #{c.id}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.skill_target && (
                      <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/[0.08]">
                        {c.skill_target.replace(/_/g, " ")}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ${statusBadge(c.status)}`}
                    >
                      {c.status}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Completed Challenges */}
      {completedChallenges.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            Completed Challenges
          </h2>
          <div className="space-y-3">
            {completedChallenges.map((c) => (
              <button
                key={c.id}
                onClick={() => handleViewResult(c.id)}
                className="w-full rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4 text-left transition-all hover:border-emerald-500/30 hover:bg-zinc-800/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                        c.winner_id === user?.id
                          ? "bg-emerald-500/20"
                          : c.winner_id === null
                            ? "bg-amber-500/20"
                            : "bg-red-500/20"
                      }`}
                    >
                      {c.winner_id === user?.id ? (
                        <svg
                          className="h-5 w-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.77.896m5.25-6.624V2.721"
                          />
                        </svg>
                      ) : (
                        <svg
                          className={`h-5 w-5 ${c.winner_id === null ? "text-amber-400" : "text-red-400"}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        Challenge #{c.id}
                        <span
                          className={`ml-2 text-xs ${
                            c.winner_id === user?.id
                              ? "text-emerald-400"
                              : c.winner_id === null
                                ? "text-amber-400"
                                : "text-red-400"
                          }`}
                        >
                          {c.winner_id === user?.id
                            ? "Won"
                            : c.winner_id === null
                              ? "Draw"
                              : "Lost"}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {c.skill_target && (
                      <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/[0.08]">
                        {c.skill_target.replace(/_/g, " ")}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${statusBadge(c.status)}`}
                    >
                      Complete
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading && challenges.length === 0 && !inQueue && (
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/40 p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
            <svg
              className="h-7 w-7 text-violet-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white">
            No challenges yet
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Click &quot;Find a Match&quot; to start your first head-to-head challenge!
          </p>
        </div>
      )}
    </div>
  );
}

/** Inline result view used inside the modal */
function ResultInline({
  result,
  currentUserId,
}: {
  result: ChallengeResultDetail;
  currentUserId: number;
}) {
  const isWinner = result.winner_id === currentUserId;
  const isDraw = result.winner_id === null;

  const GRADE_DIMENSIONS = [
    { key: "technical_accuracy", label: "Technical Accuracy" },
    { key: "risk_awareness", label: "Risk Awareness" },
    { key: "strategy_fit", label: "Strategy Fit" },
    { key: "reasoning_clarity", label: "Reasoning Clarity" },
    { key: "overall_score", label: "Overall Score" },
  ];

  function renderGrade(
    title: string,
    grade: Record<string, unknown> | null,
    winner: boolean,
  ) {
    return (
      <div
        className={`flex-1 rounded-xl border p-4 ${
          winner
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-500/20 bg-red-500/5"
        }`}
      >
        <p
          className={`mb-3 text-xs font-semibold uppercase tracking-wider ${winner ? "text-emerald-400" : "text-red-400"}`}
        >
          {title}
        </p>
        {grade ? (
          <div className="space-y-2">
            {GRADE_DIMENSIONS.map((dim) => {
              const value = grade[dim.key];
              const numValue = typeof value === "number" ? value : 0;
              const pct = Math.min(numValue * 10, 100);
              return (
                <div key={dim.key}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">{dim.label}</span>
                    <span className="font-mono text-zinc-300">
                      {typeof value === "number" ? value.toFixed(1) : "--"}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 w-full rounded-full bg-zinc-800">
                    <div
                      className={`h-1 rounded-full ${winner ? "bg-emerald-500" : "bg-red-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No grade data</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={`rounded-xl p-4 text-center ${
          isDraw
            ? "bg-amber-500/5 border border-amber-500/20"
            : isWinner
              ? "bg-emerald-500/5 border border-emerald-500/20"
              : "bg-red-500/5 border border-red-500/20"
        }`}
      >
        <p
          className={`text-xl font-bold ${isDraw ? "text-amber-400" : isWinner ? "text-emerald-400" : "text-red-400"}`}
        >
          {isDraw ? "Draw!" : isWinner ? "Victory!" : "Defeat"}
        </p>
        {result.xp_earned > 0 && (
          <p className="mt-1 text-sm text-violet-400">
            +{result.xp_earned} XP
          </p>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {renderGrade("You", result.challenger_grade, isWinner || isDraw)}
        {renderGrade("Opponent", result.opponent_grade, !isWinner && !isDraw)}
      </div>
    </div>
  );
}

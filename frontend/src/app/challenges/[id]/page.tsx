"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeEvent } from "@/lib/useRealtimeEvent";
import ChallengeResult from "@/components/ChallengeResult";
import {
  getChallenge,
  submitChallengeResponse,
  getChallengeResult,
} from "@/lib/api";
import type { ChallengeDetail, ChallengeResultDetail } from "@/lib/types";

type Phase =
  | "loading"
  | "active"
  | "submitting"
  | "waiting"
  | "grading"
  | "complete"
  | "error";

export default function ChallengePage() {
  const params = useParams();
  const challengeId = Number(params.id);
  const { user, refetchUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [result, setResult] = useState<ChallengeResultDetail | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opponentSubmitted, setOpponentSubmitted] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  // Timer
  useEffect(() => {
    if (phase !== "active") return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, startTime]);

  // Load challenge on mount
  useEffect(() => {
    async function load() {
      try {
        const c = await getChallenge(challengeId);
        setChallenge(c);
        if (c.status === "complete") {
          const r = await getChallengeResult(challengeId);
          setResult(r);
          setPhase("complete");
        } else if (c.status === "grading") {
          setPhase("grading");
        } else if (c.status === "active") {
          // Check if current user already submitted
          const iAmChallenger = c.challenger_id === user?.id;
          const iAlreadySubmitted = iAmChallenger
            ? c.challenger_submitted
            : c.opponent_submitted;
          if (iAlreadySubmitted) {
            setPhase("waiting");
            // Check if opponent also submitted
            const opponentAlsoSubmitted = iAmChallenger
              ? c.opponent_submitted
              : c.challenger_submitted;
            if (opponentAlsoSubmitted) setOpponentSubmitted(true);
          } else {
            setPhase("active");
          }
        } else {
          setPhase("active");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load challenge",
        );
        setPhase("error");
      }
    }
    load();
  }, [challengeId, user?.id]);

  // Listen for opponent submitted — both are in, move to grading
  useRealtimeEvent(
    "opponent_submitted",
    useCallback(() => {
      setOpponentSubmitted(true);
      setPhase((prev) => (prev === "waiting" ? "grading" : prev));
    }, []),
  );

  // Listen for challenge graded
  useRealtimeEvent(
    "challenge_graded",
    useCallback(
      async (data: unknown) => {
        const event = data as { challenge_id: number };
        if (event.challenge_id === challengeId) {
          try {
            const r = await getChallengeResult(challengeId);
            setResult(r);
            setPhase("complete");
            await refetchUser();
          } catch {
            // Will be picked up on next load
          }
        }
      },
      [challengeId, refetchUser],
    ),
  );

  // Listen for challenge started
  useRealtimeEvent(
    "challenge_started",
    useCallback(
      async (data: unknown) => {
        const event = data as { challenge_id: number };
        if (event.challenge_id === challengeId) {
          try {
            const c = await getChallenge(challengeId);
            setChallenge(c);
            setPhase("active");
          } catch {
            // ignore
          }
        }
      },
      [challengeId],
    ),
  );

  // Safety net: if stuck in grading for >10s, check once via HTTP
  useEffect(() => {
    if (phase !== "grading") return;
    const timer = setTimeout(async () => {
      try {
        const c = await getChallenge(challengeId);
        if (c.status === "complete") {
          const r = await getChallengeResult(challengeId);
          setResult(r);
          setPhase("complete");
          await refetchUser();
        }
      } catch {
        // ignore
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [phase, challengeId, refetchUser]);

  async function handleSubmit() {
    if (!answer.trim()) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await submitChallengeResponse(challengeId, answer) as {
        challenge_status: string;
      };
      // If both submitted, backend already started grading
      if (res.challenge_status === "complete") {
        const r = await getChallengeResult(challengeId);
        setResult(r);
        setPhase("complete");
        await refetchUser();
      } else if (res.challenge_status === "grading") {
        setPhase("grading");
      } else {
        setPhase("waiting");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit response",
      );
      setPhase("active");
    }
  }

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 relative">
        <div
          className="absolute -left-2 top-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl"
          aria-hidden
        />
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              Challenge #{challengeId}
            </h1>
            {challenge && (
              <div className="mt-2 flex items-center gap-3">
                {challenge.skill_target && (
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-white/[0.08]">
                    {challenge.skill_target.replace(/_/g, " ")}
                  </span>
                )}
                <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-400 ring-1 ring-violet-500/20">
                  Complexity: {challenge.complexity}
                </span>
              </div>
            )}
          </div>
          {phase === "active" && (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-zinc-800/60 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-sm text-zinc-300">
                {minutes.toString().padStart(2, "0")}:
                {seconds.toString().padStart(2, "0")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading state */}
      {phase === "loading" && (
        <div className="flex items-center justify-center gap-3 py-20">
          <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-violet-500 animate-spin" />
          <p className="text-sm text-zinc-500">Loading challenge...</p>
        </div>
      )}

      {/* Active: show scenario and response form */}
      {phase === "active" && challenge && (
        <div className="space-y-6">
          {/* Scenario card placeholder — the challenge scenario text would come from the backend */}
          <div className="rounded-2xl border border-violet-500/25 bg-zinc-900/80 p-6 shadow-[0_0_32px_rgba(139,92,246,0.08)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
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
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Challenge Scenario
              </span>
            </div>
            {challenge.scenario_text ? (
              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {challenge.scenario_text}
              </p>
            ) : (
              <p className="text-sm text-zinc-300 leading-relaxed">
                The scenario has been loaded. Analyze the trading situation and
                submit your best response below. Both you and your opponent receive
                the same scenario.
              </p>
            )}
          </div>

          {/* Opponent submitted notification */}
          {opponentSubmitted && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <p className="text-sm text-amber-400">
                Your opponent has submitted their response!
              </p>
            </div>
          )}

          {/* Response textarea */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">
              Your Analysis
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={8}
              placeholder="Analyze the scenario. Consider the market data, identify risks and opportunities, and propose your trading strategy..."
              className="w-full resize-none rounded-xl border border-white/[0.1] bg-zinc-800/60 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!answer.trim()}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-fuchsia-700 px-6 py-3.5 text-base font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:shadow-[0_0_40px_rgba(139,92,246,0.35)] hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <span
                className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.15),transparent)]"
                aria-hidden
              />
              <span className="relative flex items-center justify-center gap-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Submit Response
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Submitting state */}
      {phase === "submitting" && (
        <div className="flex items-center justify-center gap-3 py-20">
          <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-violet-500 animate-spin" />
          <p className="text-sm text-zinc-500">Submitting your response...</p>
        </div>
      )}

      {/* Waiting for opponent / grading */}
      {(phase === "waiting" || phase === "grading") && (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <div className="relative">
            <div className="absolute h-24 w-24 rounded-full border-2 border-violet-500/20 animate-ping" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 border border-violet-500/30">
              <svg
                className="h-10 w-10 text-violet-400 animate-pulse"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold text-white">
              {phase === "waiting"
                ? "Waiting for opponent..."
                : "Grading in progress..."}
            </h3>
            <p className="text-sm text-zinc-400">
              {phase === "waiting"
                ? "Your response has been submitted. Waiting for the other player to finish."
                : "Both responses are in. The AI is grading now."}
            </p>
            {opponentSubmitted && phase === "waiting" && (
              <p className="text-sm text-amber-400">
                Opponent has also submitted — grading should begin soon!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Complete: show result */}
      {phase === "complete" && result && user && (
        <ChallengeResult result={result} currentUserId={user.id} />
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <svg
              className="h-7 w-7 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">
            {error || "Something went wrong loading this challenge."}
          </p>
        </div>
      )}
    </div>
  );
}

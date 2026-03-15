"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePeerReviewAssignments, useReceivedReviews } from "@/lib/hooks";
import { rateHelpfulness } from "@/lib/api";
import type { PeerReviewDetail } from "@/lib/types";
import {
  gsap,
  useScrollReveal,
  useStaggerReveal,
  useProgressFill,
} from "@/lib/gsap";

type Tab = "to-review" | "received";

const SCORE_CATEGORIES = [
  { key: "technical_accuracy" as const, label: "Technical", color: "from-blue-500 to-blue-400" },
  { key: "risk_awareness" as const, label: "Risk", color: "from-amber-500 to-yellow-400" },
  { key: "strategy_fit" as const, label: "Strategy", color: "from-violet-500 to-purple-400" },
  { key: "reasoning_clarity" as const, label: "Reasoning", color: "from-cyan-500 to-teal-400" },
] as const;

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return "Due today";
    if (absDays === 1) return "Overdue by 1 day";
    return `Overdue by ${absDays} days`;
  }
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays} days`;
}

function scoreColor(score: number): string {
  if (score >= 4) return "text-emerald-400";
  if (score >= 3) return "text-yellow-400";
  return "text-red-400";
}

function scoreBadgeBg(score: number): string {
  if (score >= 4) return "bg-emerald-500/15 border-emerald-500/30 text-emerald-400";
  if (score >= 3) return "bg-amber-500/15 border-amber-500/30 text-amber-400";
  return "bg-red-500/15 border-red-500/30 text-red-400";
}

function scoreBadgeGlow(score: number): string {
  if (score >= 4) return "shadow-[0_0_20px_rgba(34,197,94,0.15)]";
  if (score >= 3) return "shadow-[0_0_20px_rgba(245,158,11,0.15)]";
  return "shadow-[0_0_20px_rgba(239,68,68,0.15)]";
}

function ScoreBar({
  label,
  value,
  gradient,
  index,
}: {
  label: string;
  value: number;
  gradient: string;
  index: number;
}) {
  const pct = (value / 5) * 100;
  const barRef = useProgressFill<HTMLDivElement>(pct, {
    duration: 0.8,
    delay: 0.1 * index,
  });

  return (
    <div className="group flex items-center gap-3">
      <span className="text-xs text-zinc-500 w-20 group-hover:text-zinc-300 transition-colors">
        {label}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
        <div
          ref={barRef}
          className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
        />
      </div>
      <span className={`text-xs font-mono w-8 text-right tabular-nums ${scoreColor(value)}`}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function StarRating({
  review,
  onRate,
}: {
  review: PeerReviewDetail;
  onRate: (review: PeerReviewDetail, rating: number) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 mr-2">
        Helpful?
      </span>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled =
          hovered != null
            ? star <= hovered
            : review.helpfulness_rating != null && star <= review.helpfulness_rating;

        return (
          <button
            key={star}
            onClick={() => onRate(review, star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className={`relative text-lg transition-all duration-200 hover:scale-125 active:scale-95 ${
              filled
                ? "text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                : "text-zinc-700 hover:text-amber-400/40"
            }`}
            title={`Rate ${star}`}
          >
            &#9733;
          </button>
        );
      })}
      {review.helpfulness_rating != null && (
        <span className="ml-1 text-xs text-zinc-500 font-mono tabular-nums">
          {review.helpfulness_rating}/5
        </span>
      )}
    </div>
  );
}

export default function PeerReviewPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();
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

  // Capture current time once (on mount) to avoid impure Date.now() calls in JSX
  const [now] = useState(() => Date.now());

  // Counts
  const pendingCount = assignments?.filter((a) => a.status === "assigned").length ?? 0;
  const receivedCount = reviews?.length ?? 0;

  // GSAP refs
  const heroRef = useRef<HTMLDivElement>(null);
  const cardsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.08, y: 24 });
  const tabBarRef = useScrollReveal<HTMLDivElement>({ y: 20, delay: 0.2 });

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".pr-hero-title", {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
      });
      gsap.from(".pr-hero-subtitle", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.15,
        ease: "power3.out",
      });
      gsap.from(".pr-hero-stats", {
        opacity: 0,
        x: 20,
        duration: 0.6,
        delay: 0.3,
        ease: "power3.out",
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  if (!authLoading && authUser && authUser.role !== "student") {
    router.replace("/");
    return null;
  }

  async function handleRate(review: PeerReviewDetail, rating: number) {
    try {
      await rateHelpfulness(review.id, rating);
      mutateReviews();
    } catch {
      // ignore
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className="relative mb-8 overflow-hidden rounded-3xl border border-white/[0.06] p-8 sm:p-10"
        style={{
          background:
            "linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.15) 40%, rgba(99,102,241,0.12) 100%)",
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-500/[0.08] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-blue-500/[0.06] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-indigo-500/[0.05] blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text */}
          <div className="min-w-0">
            <div className="pr-hero-title flex items-center gap-3 mb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Peer Review
                </span>
              </h1>
            </div>
            <p className="pr-hero-subtitle text-sm text-zinc-400 max-w-md leading-relaxed">
              Sharpen your skills through collaborative learning. Review your
              peers&apos; work and gain insights from their feedback on yours.
            </p>
          </div>

          {/* Right — Quick stats pills */}
          <div className="pr-hero-stats flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/[0.08] px-4 py-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6l4 2"
                  />
                  <circle cx="12" cy="12" r="10" strokeWidth={2} />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-white leading-none">
                  {pendingCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-amber-400/70">
                  To Review
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.08] px-4 py-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold tabular-nums text-white leading-none">
                  {receivedCount}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-cyan-400/70">
                  Received
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div
        ref={tabBarRef}
        className="relative mb-8 inline-flex rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-1"
      >
        {(
          [
            { key: "to-review" as Tab, label: "To Review", count: pendingCount },
            { key: "received" as Tab, label: "Received", count: receivedCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative rounded-xl px-6 py-2.5 text-sm font-medium transition-all duration-300 ${
              activeTab === tab.key
                ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-white shadow-[0_0_16px_rgba(6,182,212,0.15)]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span
                className={`ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  activeTab === tab.key
                    ? "bg-cyan-400/20 text-cyan-300"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="relative h-28 animate-pulse overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/50"
            >
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${
                  i % 2 === 0 ? "bg-cyan-500/30" : "bg-amber-500/30"
                }`}
              />
              <div className="p-5">
                <div className="h-4 w-48 rounded bg-zinc-800/80 mb-3" />
                <div className="h-3 w-32 rounded bg-zinc-800/60" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-5 flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-400">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-red-400">
              Something went wrong
            </p>
            <p className="text-xs text-red-400/70 mt-0.5">
              {error instanceof Error ? error.message : "Failed to load data"}
            </p>
          </div>
        </div>
      )}

      {/* ── To Review Tab ── */}
      {!isLoading && !error && activeTab === "to-review" && (
        <div ref={cardsRef} className="space-y-3">
          {(assignments ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-900/40 py-16 px-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 mb-4">
                <svg
                  className="h-7 w-7 text-amber-500/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400 mb-1">
                No review assignments yet
              </p>
              <p className="text-xs text-zinc-600 max-w-xs mb-5">
                Complete scenarios to start receiving peer work to review.
                Reviewing others helps you learn too!
              </p>
              <Link
                href="/scenario"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 px-5 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:border-cyan-500/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.12)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Start a Scenario
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>
          )}
          {(assignments ?? []).map((assignment) => {
            const isPending = assignment.status === "assigned";
            const isDone = assignment.status === "submitted";

            return (
              <Link
                key={assignment.id}
                href={`/peer-review/${assignment.id}`}
                className="group relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/50 transition-all duration-300 hover:border-cyan-500/20 hover:bg-zinc-900/70 hover:shadow-[0_0_24px_rgba(6,182,212,0.06)]"
              >
                {/* Left accent stripe */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                    isPending
                      ? "bg-gradient-to-b from-amber-400 to-yellow-500 group-hover:shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                      : isDone
                        ? "bg-gradient-to-b from-emerald-400 to-green-500 group-hover:shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                        : "bg-gradient-to-b from-zinc-500 to-zinc-600"
                  }`}
                />

                <div className="flex flex-col gap-3 p-5 pl-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-cyan-100 transition-colors">
                      Review Assignment #{assignment.id}
                    </p>
                    <p className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-0.5">
                        Response #{assignment.response_id}
                      </span>
                      <span>&middot;</span>
                      <span>
                        {new Date(assignment.created_at).toLocaleDateString()}
                      </span>
                    </p>
                    {assignment.due_at && (
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            new Date(assignment.due_at).getTime() < now
                              ? "bg-red-500/10 text-red-400 ring-1 ring-red-500/20"
                              : "bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20"
                          }`}
                        >
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6v6l4 2"
                            />
                            <circle cx="12" cy="12" r="10" strokeWidth={2} />
                          </svg>
                          {getRelativeTime(assignment.due_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                        isPending
                          ? "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20"
                          : isDone
                            ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                            : "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20"
                      }`}
                    >
                      {assignment.status}
                    </span>
                    {isPending && (
                      <span className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/25 px-4 py-2 text-xs font-semibold text-cyan-300 transition-all group-hover:bg-cyan-500/25 group-hover:border-cyan-500/40 group-hover:shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                        Review Now
                        <svg
                          className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Received Tab ── */}
      {!isLoading && !error && activeTab === "received" && (
        <div ref={cardsRef} className="space-y-4">
          {(reviews ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-900/40 py-16 px-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 mb-4">
                <svg
                  className="h-7 w-7 text-cyan-500/60"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-zinc-400 mb-1">
                No reviews received yet
              </p>
              <p className="text-xs text-zinc-600 max-w-xs mb-5">
                Submit scenario responses to receive peer feedback. The more you
                practice, the more feedback you&apos;ll get!
              </p>
              <Link
                href="/lessons"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 px-5 py-2.5 text-sm font-medium text-cyan-300 transition-all hover:border-cyan-500/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.12)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Browse Lessons
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Link>
            </div>
          )}
          {(reviews ?? []).map((review) => (
            <div
              key={review.id}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-900/50 transition-all duration-300 hover:border-indigo-500/15 hover:bg-zinc-900/70"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-5 pb-0">
                <div>
                  <p className="text-sm font-semibold text-white">
                    Review #{review.id}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
                {/* Score badge */}
                <div
                  className={`flex flex-col items-center rounded-2xl border px-4 py-2.5 ${scoreBadgeBg(review.overall_score)} ${scoreBadgeGlow(review.overall_score)}`}
                >
                  <span className="text-xl font-bold tabular-nums leading-none">
                    {review.overall_score.toFixed(1)}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider opacity-70 mt-0.5">
                    Overall
                  </span>
                </div>
              </div>

              {/* Score breakdown bars */}
              <div className="px-5 pt-4 pb-2 space-y-2.5">
                {SCORE_CATEGORIES.map((cat, i) => (
                  <ScoreBar
                    key={cat.key}
                    label={cat.label}
                    value={review[cat.key]}
                    gradient={cat.color}
                    index={i}
                  />
                ))}
              </div>

              {/* Feedback quote */}
              {review.feedback_text && (
                <div className="mx-5 mt-3 mb-2 rounded-xl border-l-2 border-cyan-500/30 bg-cyan-500/[0.04] py-3 px-4">
                  <p className="text-sm text-zinc-300 leading-relaxed italic">
                    &ldquo;{review.feedback_text}&rdquo;
                  </p>
                </div>
              )}

              {/* Star rating */}
              <div className="px-5 pt-3 pb-5">
                <StarRating review={review} onRate={handleRate} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

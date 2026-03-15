"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeEvent } from "@/lib/useRealtimeEvent";
import {
  useTextReveal,
  useScrollReveal,
  useStaggerReveal,
  useProgressFill,
  gsap,
} from "@/lib/gsap";
import {
  createOpenChallenge,
  cancelOpenChallenge,
  getMyChallenges,
  getChallengeResult,
  getOpenChallenges,
  acceptChallenge,
  getOnlineCount,
} from "@/lib/api";
import type {
  ChallengeDetail,
  ChallengeResultDetail,
  OpenChallengeEntry,
} from "@/lib/types";
import { ChallengesSkeleton } from "@/components/skeletons/ChallengesSkeleton";

const SKILL_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "", label: "Any Skill", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  {
    value: "price_action",
    label: "Price Action",
    icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  },
  {
    value: "options_chain",
    label: "Options Chain",
    icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zm9.75-9.75A2.25 2.25 0 0115.75 3.75H18a2.25 2.25 0 012.25 2.25v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z",
  },
  {
    value: "strike_select",
    label: "Strike Selection",
    icon: "M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z",
  },
  {
    value: "risk_mgmt",
    label: "Risk Management",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
  {
    value: "position_size",
    label: "Position Sizing",
    icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z",
  },
  {
    value: "regime_id",
    label: "Regime Identification",
    icon: "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    value: "vol_assess",
    label: "Volatility Assessment",
    icon: "M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5",
  },
  {
    value: "trade_mgmt",
    label: "Trade Management",
    icon: "M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75",
  },
];

function skillLabel(value: string): string {
  return (
    SKILL_OPTIONS.find((s) => s.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000,
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ChallengesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [skillTarget, setSkillTarget] = useState("");
  const [myPendingId, setMyPendingId] = useState<number | null>(null);
  const [challenges, setChallenges] = useState<ChallengeDetail[]>([]);
  const [openChallenges, setOpenChallenges] = useState<OpenChallengeEntry[]>(
    [],
  );
  const [selectedResult, setSelectedResult] =
    useState<ChallengeResultDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);

  // GSAP animation refs
  const heroTitleRef = useTextReveal<HTMLHeadingElement>();
  const heroRef = useRef<HTMLDivElement>(null);
  const createCardRef = useScrollReveal<HTMLDivElement>();
  const openListRef = useStaggerReveal<HTMLDivElement>();
  const activeListRef = useStaggerReveal<HTMLDivElement>();
  const completedListRef = useStaggerReveal<HTMLDivElement>();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const waitingCardRef = useRef<HTMLDivElement>(null);
  const waitingRingRef = useRef<HTMLDivElement>(null);
  const ctaGlowRef = useRef<HTMLButtonElement>(null);

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current || loading) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-subtitle", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.35,
        ease: "power3.out",
      });
      gsap.from(".hero-stat-pill", {
        opacity: 0,
        scale: 0.8,
        duration: 0.5,
        stagger: 0.1,
        delay: 0.5,
        ease: "back.out(1.7)",
      });
    }, heroRef);
    return () => ctx.revert();
  }, [loading]);

  // CTA button animated glow border
  useEffect(() => {
    const el = ctaGlowRef.current;
    if (!el || myPendingId) return;

    const tween = gsap.to(el, {
      boxShadow:
        "0 0 30px rgba(139,92,246,0.4), 0 0 60px rgba(217,70,239,0.15), 0 0 0 1px rgba(255,255,255,0.08) inset",
      duration: 2,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    return () => {
      tween.kill();
    };
  }, [myPendingId]);

  // Result modal entrance animation
  useEffect(() => {
    if (selectedResult && modalContentRef.current) {
      gsap.from(modalContentRef.current, {
        scale: 0.9,
        opacity: 0,
        duration: 0.3,
        ease: "back.out(1.4)",
      });
    }
  }, [selectedResult]);

  // Waiting card radar ping animation
  useEffect(() => {
    const el = waitingCardRef.current;
    const ringEl = waitingRingRef.current;
    if (!el || !ringEl || !myPendingId) return;

    const borderTween = gsap.to(el, {
      borderColor: "rgba(168, 85, 247, 0.5)",
      boxShadow: "0 0 40px rgba(168, 85, 247, 0.15)",
      duration: 1.5,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true,
    });

    // Radar ping rings
    const pingTl = gsap.timeline({ repeat: -1 });
    pingTl
      .fromTo(
        ringEl,
        { scale: 0.5, opacity: 0.8 },
        { scale: 2.5, opacity: 0, duration: 2, ease: "power2.out" },
      )
      .set(ringEl, { scale: 0.5, opacity: 0.8 });

    return () => {
      borderTween.kill();
      pingTl.kill();
    };
  }, [myPendingId]);

  // Load challenges and open challenges
  const loadChallenges = useCallback(async () => {
    try {
      const [myChallenges, open, onlineData] = await Promise.all([
        getMyChallenges(),
        getOpenChallenges(),
        getOnlineCount().catch(() => ({ online_count: 0 })),
      ]);
      setOnlineCount(onlineData.online_count);
      setChallenges(myChallenges);
      setOpenChallenges(open);

      // Check if user has a pending challenge
      const pending = myChallenges.find(
        (c) => c.status === "pending" && c.challenger_id === user?.id,
      );
      setMyPendingId(pending?.id ?? null);
    } catch {
      // Silently fail — user might not be authenticated yet
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Load on mount
  useEffect(() => {
    loadChallenges();
  }, [loadChallenges]);

  // Refresh when page becomes visible (user navigates back)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        loadChallenges();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [loadChallenges]);

  // Listen for match found — redirect to challenge page
  useRealtimeEvent(
    "challenge_matched",
    useCallback(
      (data: unknown) => {
        const event = data as { challenge_id: number };
        setMyPendingId(null);
        router.push(`/challenges/${event.challenge_id}`);
      },
      [router],
    ),
  );

  // Listen for new open challenges
  useRealtimeEvent(
    "challenge_open",
    useCallback(
      (data: unknown) => {
        const event = data as {
          challenge_id: number;
          user_id: number;
          username: string;
          skill_target: string | null;
          created_at: string;
        };
        // Don't show our own challenge
        if (event.user_id === user?.id) return;
        setOpenChallenges((prev) => {
          if (prev.some((e) => e.challenge_id === event.challenge_id))
            return prev;
          return [
            {
              challenge_id: event.challenge_id,
              user_id: event.user_id,
              username: event.username,
              skill_target: event.skill_target,
              created_at: event.created_at,
            },
            ...prev,
          ];
        });
      },
      [user?.id],
    ),
  );

  // Listen for cancelled/accepted challenges
  useRealtimeEvent(
    "challenge_cancelled",
    useCallback((data: unknown) => {
      const event = data as { challenge_id: number };
      setOpenChallenges((prev) =>
        prev.filter((e) => e.challenge_id !== event.challenge_id),
      );
    }, []),
  );

  async function handleCreateChallenge() {
    setError(null);
    setCreating(true);
    try {
      const challenge = await createOpenChallenge(skillTarget || undefined);
      setMyPendingId(challenge.id);
      setChallenges((prev) => [challenge, ...prev]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create challenge",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleCancelChallenge() {
    if (!myPendingId) return;
    setError(null);
    try {
      await cancelOpenChallenge(myPendingId);
      setChallenges((prev) => prev.filter((c) => c.id !== myPendingId));
      setMyPendingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    }
  }

  async function handleAcceptChallenge(challengeId: number) {
    setError(null);
    setAcceptingId(challengeId);
    try {
      const challenge = await acceptChallenge(challengeId);
      router.push(`/challenges/${challenge.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to accept challenge",
      );
      // Remove stale entry
      setOpenChallenges((prev) =>
        prev.filter((e) => e.challenge_id !== challengeId),
      );
    } finally {
      setAcceptingId(null);
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
    (c) => c.status !== "complete" && c.status !== "pending",
  );
  const completedChallenges = challenges.filter(
    (c) => c.status === "complete",
  );

  // Stats
  const totalBattles = completedChallenges.length;
  const wins = completedChallenges.filter(
    (c) => c.winner_id === user?.id,
  ).length;
  const winRate =
    totalBattles > 0 ? Math.round((wins / totalBattles) * 100) : 0;
  const activeCount = activeChallenges.length;

  const selectedSkillOption = SKILL_OPTIONS.find(
    (s) => s.value === skillTarget,
  );

  if (loading) {
    return <ChallengesSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] p-5 sm:p-8 lg:p-10"
        style={{
          background:
            "linear-gradient(135deg, rgba(134,25,143,0.4) 0%, rgba(88,28,135,0.5) 30%, rgba(109,40,217,0.4) 60%, rgba(76,29,149,0.5) 100%)",
        }}
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute left-1/4 -bottom-12 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-purple-400/10 blur-3xl"
          aria-hidden
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — Text */}
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1">
              <svg
                className="h-3.5 w-3.5 text-fuchsia-400"
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
              <span className="text-[11px] font-semibold uppercase tracking-wider text-fuchsia-300">
                PvP Arena
              </span>
            </div>
            <h1
              ref={heroTitleRef}
              className="text-3xl font-bold tracking-tight sm:text-4xl bg-gradient-to-r from-white via-fuchsia-200 to-violet-200 bg-clip-text text-transparent"
            >
              Head-to-Head Challenges
            </h1>
            <p className="hero-subtitle mt-2 text-sm text-violet-200/60 max-w-md">
              Prove your trading skills against other players. Create a
              challenge or accept one to battle in real-time.
            </p>
          </div>

          {/* Right — Quick Stats */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Total Battles */}
            <div className="hero-stat-pill flex flex-col items-center rounded-2xl border border-fuchsia-500/20 bg-black/20 backdrop-blur-sm px-4 py-3 min-w-[80px]">
              <span className="text-2xl font-bold tabular-nums text-white">
                {totalBattles}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-300/70">
                Battles
              </span>
            </div>

            {/* Win Rate */}
            <div className="hero-stat-pill flex flex-col items-center rounded-2xl border border-emerald-500/20 bg-black/20 backdrop-blur-sm px-4 py-3 min-w-[80px]">
              <span className="text-2xl font-bold tabular-nums text-white">
                {winRate}
                <span className="text-sm font-normal text-emerald-400/70">
                  %
                </span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/70">
                Win Rate
              </span>
            </div>

            {/* Active */}
            <div className="hero-stat-pill flex flex-col items-center rounded-2xl border border-blue-500/20 bg-black/20 backdrop-blur-sm px-4 py-3 min-w-[80px]">
              <span className="text-2xl font-bold tabular-nums text-white">
                {activeCount}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-blue-300/70">
                Active
              </span>
            </div>

            {/* Online */}
            <div className="hero-stat-pill flex flex-col items-center rounded-2xl border border-green-500/20 bg-black/20 backdrop-blur-sm px-4 py-3 min-w-[80px]">
              <span className="text-2xl font-bold tabular-nums text-white flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                {onlineCount}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-green-300/70">
                Online
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm flex items-center gap-3">
          <svg
            className="h-5 w-5 shrink-0"
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
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400 transition-colors"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Result Modal */}
      {selectedResult && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div
            ref={modalContentRef}
            className="w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-zinc-900/98 shadow-2xl overflow-hidden"
          >
            <ResultInline
              result={selectedResult}
              currentUserId={user.id}
              onClose={() => setSelectedResult(null)}
            />
          </div>
        </div>
      )}

      {/* My pending challenge — Matchmaking Screen */}
      {myPendingId ? (
        <div className="mb-10">
          <div
            ref={waitingCardRef}
            className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-zinc-900/80 p-6 sm:p-10"
          >
            {/* Background decoration */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(168,85,247,0.4) 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
              aria-hidden
            />

            <div className="relative flex flex-col items-center text-center">
              {/* Pulsing radar ring */}
              <div className="relative mb-8">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20">
                  <svg
                    className="h-10 w-10 text-violet-400"
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
                {/* Animated ping ring */}
                <div
                  ref={waitingRingRef}
                  className="absolute inset-0 rounded-full border-2 border-violet-400/40"
                  aria-hidden
                />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                Searching for opponent
                <span className="inline-flex w-8 text-left">
                  <span className="animate-pulse">...</span>
                </span>
              </h3>
              <p className="text-sm text-zinc-400 max-w-sm mb-6">
                Your challenge is live. When another trader accepts, you will
                both enter the arena simultaneously.
              </p>

              <button
                onClick={handleCancelChallenge}
                className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-5 py-2 text-sm font-medium text-zinc-400 transition-all hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5"
              >
                Cancel Challenge
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Create Challenge */
        !loading && (
          <div className="mb-10">
            <div
              ref={createCardRef}
              className="relative overflow-hidden rounded-3xl bg-zinc-900/80 p-6 sm:p-8"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(139,92,246,0.2), 0 0 40px rgba(139,92,246,0.06)",
              }}
            >
              {/* Grid pattern bg */}
              <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
                aria-hidden
              />
              <div
                className="absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-violet-500/10 blur-3xl"
                aria-hidden
              />
              <div
                className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-fuchsia-500/10 blur-3xl"
                aria-hidden
              />

              <div className="relative">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20">
                    {/* Crossed swords icon */}
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
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Create a Challenge
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Choose your skill arena and find an opponent
                    </p>
                  </div>
                  {/* VS badge */}
                  <div className="ml-auto hidden sm:flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 border border-fuchsia-500/20">
                    <span className="text-sm font-black text-fuchsia-400 italic">
                      VS
                    </span>
                  </div>
                </div>

                {/* Skill selector */}
                <div className="mb-5">
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
                    Skill Arena
                  </label>
                  <div className="relative max-w-sm">
                    <select
                      value={skillTarget}
                      onChange={(e) => setSkillTarget(e.target.value)}
                      className="w-full bg-zinc-800/60 border border-white/[0.1] rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 appearance-none cursor-pointer transition-colors hover:border-white/[0.18] pr-10"
                    >
                      {SKILL_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                    {/* Custom dropdown icon */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg
                        className="h-4 w-4 text-zinc-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </div>
                  {/* Selected skill preview */}
                  {selectedSkillOption && skillTarget && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1">
                      <svg
                        className="h-3.5 w-3.5 text-violet-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={selectedSkillOption.icon}
                        />
                      </svg>
                      <span className="text-xs font-medium text-violet-300">
                        {selectedSkillOption.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  ref={ctaGlowRef}
                  onClick={handleCreateChallenge}
                  disabled={creating}
                  className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 px-6 py-5 text-lg font-bold text-white shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span
                    className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.18),transparent)]"
                    aria-hidden
                  />
                  <span className="relative flex items-center justify-center gap-3">
                    <svg
                      className="h-6 w-6 transition-transform group-hover:scale-110"
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
                    {creating ? "Entering Arena..." : "Enter the Arena"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {/* Open Challenges from other users */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <h2 className="text-lg font-semibold text-white">
            Open Challenges
          </h2>
          <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-green-400 tabular-nums">
            {openChallenges.length}
          </span>
          {onlineCount > 1 && (
            <span className="ml-auto text-xs text-zinc-500">
              {onlineCount} traders online
            </span>
          )}
        </div>
        <div ref={openListRef} className="space-y-3">
          {openChallenges.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-zinc-900/40 p-8 text-center">
              <p className="text-sm text-zinc-500">
                No open challenges right now. Create one above and other online traders will be notified!
              </p>
            </div>
          )}
          {openChallenges.map((entry) => (
              <div
                key={entry.challenge_id}
                className="group relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 sm:p-5 transition-all hover:border-green-500/25 hover:bg-zinc-800/60 hover:shadow-[0_0_24px_rgba(34,197,94,0.06)] border-l-[3px] border-l-green-500/40"
              >
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Avatar */}
                  <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold text-white uppercase shadow-lg shadow-violet-500/20">
                    {entry.username.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {entry.username}
                      <span className="ml-2 text-xs font-normal text-zinc-500">
                        wants to battle
                      </span>
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {entry.skill_target && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[11px] font-medium text-violet-400 ring-1 ring-violet-500/20">
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d={
                                SKILL_OPTIONS.find(
                                  (s) => s.value === entry.skill_target,
                                )?.icon ??
                                "M13 10V3L4 14h7v7l9-11h-7z"
                              }
                            />
                          </svg>
                          {skillLabel(entry.skill_target)}
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-600">
                        {timeAgo(entry.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleAcceptChallenge(entry.challenge_id)}
                  disabled={acceptingId === entry.challenge_id}
                  className="self-end sm:self-center shrink-0 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_16px_rgba(34,197,94,0.2)] transition-all hover:shadow-[0_0_28px_rgba(34,197,94,0.35)] hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {acceptingId === entry.challenge_id ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Joining...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Accept
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
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            ))}
        </div>
      </section>

      {/* Active Challenges */}
      {activeChallenges.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Active Challenges
            </h2>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400 tabular-nums">
              {activeChallenges.length}
            </span>
          </div>
          <div ref={activeListRef} className="space-y-3">
            {activeChallenges.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/challenges/${c.id}`)}
                className="group w-full rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 sm:p-5 text-left transition-all hover:border-blue-500/30 hover:bg-zinc-800/60 hover:shadow-[0_0_24px_rgba(59,130,246,0.08)] border-l-[3px] border-l-blue-500/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">
                      <svg
                        className="h-5 w-5 text-blue-400"
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
                      <p className="text-sm font-semibold text-white">
                        Challenge #{c.id}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {new Date(c.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {c.skill_target && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/[0.08]">
                        {skillLabel(c.skill_target)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-blue-400 ring-1 ring-blue-500/20">
                      {c.status}
                    </span>
                    <span className="text-xs font-medium text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Continue
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 7l5 5m0 0l-5 5m5-5H6"
                        />
                      </svg>
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
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">
              Completed Challenges
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400 tabular-nums">
              {completedChallenges.length}
            </span>
          </div>
          <div ref={completedListRef} className="space-y-3">
            {completedChallenges.map((c) => {
              const isWin = c.winner_id === user?.id;
              const isDraw = c.winner_id === null;
              const accentClass = isWin
                ? "border-l-emerald-500/50 hover:border-emerald-500/30"
                : isDraw
                  ? "border-l-amber-500/50 hover:border-amber-500/30"
                  : "border-l-red-500/50 hover:border-red-500/30";
              const resultText = isWin
                ? "Victory"
                : isDraw
                  ? "Draw"
                  : "Defeat";
              const resultColor = isWin
                ? "text-emerald-400"
                : isDraw
                  ? "text-amber-400"
                  : "text-red-400";
              const resultBg = isWin
                ? "bg-emerald-500/10 ring-emerald-500/20"
                : isDraw
                  ? "bg-amber-500/10 ring-amber-500/20"
                  : "bg-red-500/10 ring-red-500/20";
              const iconBg = isWin
                ? "bg-emerald-500/20"
                : isDraw
                  ? "bg-amber-500/20"
                  : "bg-red-500/20";

              return (
                <button
                  key={c.id}
                  onClick={() => handleViewResult(c.id)}
                  className={`group w-full rounded-2xl border border-white/[0.08] bg-zinc-900/60 p-4 sm:p-5 text-left transition-all hover:bg-zinc-800/60 border-l-[3px] ${accentClass}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
                      >
                        {isWin ? (
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
                        ) : isDraw ? (
                          <svg
                            className="h-5 w-5 text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="h-5 w-5 text-red-400"
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
                        <p className="text-sm font-semibold text-white">
                          Challenge #{c.id}
                          <span
                            className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${resultBg} ${resultColor}`}
                          >
                            {resultText}
                          </span>
                        </p>
                        <p className="text-xs text-zinc-500">
                          {new Date(c.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {c.skill_target && (
                        <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/[0.08]">
                          {skillLabel(c.skill_target)}
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors flex items-center gap-1">
                        View
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!loading &&
        challenges.length === 0 &&
        !myPendingId &&
        openChallenges.length === 0 && (
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-zinc-900/40 p-8 sm:p-12 text-center">
            {/* Subtle grid bg */}
            <div
              className="absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
              aria-hidden
            />
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-48 rounded-full bg-violet-500/5 blur-3xl"
              aria-hidden
            />

            <div className="relative">
              {/* Stacked icons illustration */}
              <div className="mx-auto mb-6 flex items-center justify-center">
                <div className="relative">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-violet-500/20">
                    <svg
                      className="h-8 w-8 text-violet-400"
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
                  {/* Decorative floating bolt */}
                  <div className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/15 border border-fuchsia-500/20">
                    <svg
                      className="h-4 w-4 text-fuchsia-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2">
                No challenges yet
              </h3>
              <p className="text-sm text-zinc-400 max-w-md mx-auto mb-1">
                The arena is waiting for its first challenger.
              </p>
              <p className="text-xs text-zinc-600 max-w-sm mx-auto">
                Create an open challenge to invite others to compete, or wait
                for another trader to throw down the gauntlet.
              </p>
            </div>
          </div>
        )}
    </div>
  );
}

/** Inline result view used inside the modal */
function ResultInline({
  result,
  currentUserId,
  onClose,
}: {
  result: ChallengeResultDetail;
  currentUserId: number;
  onClose: () => void;
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

  const headerGradient = isDraw
    ? "from-amber-600/30 via-amber-700/20 to-amber-800/30"
    : isWinner
      ? "from-emerald-600/30 via-emerald-700/20 to-emerald-800/30"
      : "from-red-600/20 via-red-700/15 to-red-800/20";

  const headerGlow = isDraw
    ? "bg-amber-500/10"
    : isWinner
      ? "bg-emerald-500/10"
      : "bg-red-500/10";

  const headerText = isDraw
    ? "text-amber-400"
    : isWinner
      ? "text-emerald-400"
      : "text-red-400";

  function ScoreBar({
    label,
    value,
    isPositive,
  }: {
    label: string;
    value: number | unknown;
    isPositive: boolean;
  }) {
    const numValue = typeof value === "number" ? value : 0;
    const pct = Math.min(numValue * 10, 100);
    const barRef = useProgressFill<HTMLDivElement>(pct, {
      duration: 0.8,
      delay: 0.2,
    });
    const gradientClass = isPositive
      ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
      : "bg-gradient-to-r from-red-600 to-red-400";

    return (
      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-zinc-400">{label}</span>
          <span className="font-mono text-zinc-300">
            {typeof value === "number" ? value.toFixed(1) : "--"}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-zinc-800">
          <div
            ref={barRef}
            className={`h-1.5 rounded-full ${gradientClass}`}
          />
        </div>
      </div>
    );
  }

  function renderGrade(
    title: string,
    grade: Record<string, unknown> | null,
    isPositive: boolean,
  ) {
    const borderColor = isPositive
      ? "border-emerald-500/25"
      : "border-red-500/20";
    const bgColor = isPositive ? "bg-emerald-500/[0.03]" : "bg-red-500/[0.03]";
    const titleColor = isPositive ? "text-emerald-400" : "text-red-400";

    return (
      <div
        className={`flex-1 rounded-2xl border ${borderColor} ${bgColor} p-5`}
      >
        <p
          className={`mb-4 text-xs font-bold uppercase tracking-wider ${titleColor}`}
        >
          {title}
        </p>
        {grade ? (
          <div className="space-y-3">
            {GRADE_DIMENSIONS.map((dim) => (
              <ScoreBar
                key={dim.key}
                label={dim.label}
                value={grade[dim.key]}
                isPositive={isPositive}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No grade data</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Header banner */}
      <div
        className={`relative overflow-hidden bg-gradient-to-r ${headerGradient} p-6 sm:p-8`}
      >
        {/* Decorative scattered dots for victory */}
        {isWinner && (
          <>
            <div
              className="absolute top-3 left-8 h-1.5 w-1.5 rounded-full bg-emerald-400/40"
              aria-hidden
            />
            <div
              className="absolute top-6 left-20 h-1 w-1 rounded-full bg-emerald-300/30"
              aria-hidden
            />
            <div
              className="absolute top-2 right-16 h-2 w-2 rounded-full bg-emerald-400/30"
              aria-hidden
            />
            <div
              className="absolute top-8 right-32 h-1 w-1 rounded-full bg-emerald-300/40"
              aria-hidden
            />
            <div
              className="absolute top-4 right-8 h-1.5 w-1.5 rounded-full bg-green-400/30"
              aria-hidden
            />
            <div
              className="absolute top-10 left-40 h-1 w-1 rounded-full bg-emerald-400/25"
              aria-hidden
            />
            <div
              className="absolute top-1 left-1/2 h-1.5 w-1.5 rounded-full bg-green-300/30"
              aria-hidden
            />
            <div
              className="absolute top-7 right-1/4 h-1 w-1 rounded-full bg-emerald-400/35"
              aria-hidden
            />
          </>
        )}

        <div
          className={`absolute inset-0 ${headerGlow} blur-3xl`}
          aria-hidden
        />
        <div className="relative flex items-center justify-between">
          <div>
            <p
              className={`text-2xl sm:text-3xl font-black tracking-tight ${headerText}`}
            >
              {isDraw ? "Draw!" : isWinner ? "Victory!" : "Defeat"}
            </p>
            {result.xp_earned > 0 && (
              <p className="mt-1 text-sm font-semibold text-violet-400">
                +{result.xp_earned} XP earned
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
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
      </div>

      {/* Grade comparison */}
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row">
          {renderGrade("You", result.challenger_grade, isWinner || isDraw)}
          {renderGrade(
            "Opponent",
            result.opponent_grade,
            !isWinner && !isDraw,
          )}
        </div>
      </div>
    </div>
  );
}

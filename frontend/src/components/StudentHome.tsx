"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonProgress, useStreak, useLeaderboard } from "@/lib/hooks";

const LEVEL_THRESHOLDS: [number, number][] = [
  [10, 16000],
  [9, 12000],
  [8, 9000],
  [7, 6500],
  [6, 4500],
  [5, 3000],
  [4, 2000],
  [3, 1200],
  [2, 500],
  [1, 0],
];

function getXpProgress(
  xpTotal: number,
  level: number
): { currentThreshold: number; nextThreshold: number; progressPct: number } {
  const currentEntry = LEVEL_THRESHOLDS.find(([lvl]) => lvl === level);
  const nextEntry = LEVEL_THRESHOLDS.find(([lvl]) => lvl === level + 1);

  const currentThreshold = currentEntry?.[1] ?? 0;
  const nextThreshold = nextEntry?.[1] ?? currentThreshold;

  if (nextThreshold <= currentThreshold) {
    return { currentThreshold, nextThreshold, progressPct: 100 };
  }

  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((xpTotal - currentThreshold) / (nextThreshold - currentThreshold)) * 100
    )
  );

  return { currentThreshold, nextThreshold, progressPct };
}

const SKILLS = [
  { id: "price_action", label: "Price Action" },
  { id: "options_chain", label: "Options Chain" },
  { id: "strike_select", label: "Strike Selection" },
  { id: "risk_mgmt", label: "Risk Management" },
  { id: "position_size", label: "Position Sizing" },
  { id: "regime_id", label: "Regime ID" },
  { id: "vol_assess", label: "Volatility Assessment" },
  { id: "trade_mgmt", label: "Trade Management" },
];

function getBadgeIcon(name: string): string {
  if (name.includes("Streak")) return "🔥";
  if (name.includes("Mastery")) return "⭐";
  if (name.includes("Finisher") || name.includes("Complete")) return "🏆";
  return "🎖️";
}

export default function StudentHome() {
  const { user } = useAuth();
  const {
    data: progress,
    isLoading: progressLoading,
  } = useLessonProgress();
  const { data: streak, isLoading: streakLoading } = useStreak();
  const { data: leaderboard, isLoading: leaderboardLoading } =
    useLeaderboard();

  const isLoading =
    !user || progressLoading || streakLoading || leaderboardLoading;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-zinc-500 text-lg">
            Loading your dashboard...
          </div>
        </div>
      </div>
    );
  }

  const xpTotal = user?.xp_total ?? 0;
  const level = user?.level ?? 1;
  const username = user?.username ?? "Trader";
  const { nextThreshold, progressPct } = getXpProgress(xpTotal, level);

  const currentStreak = streak?.current_streak ?? 0;

  const userRank = leaderboard?.find(
    (entry) => entry.user_id === user?.id
  )?.rank;

  const badges = progress?.badges ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {/* 1. Welcome Header */}
      <div className="animate-slide-up mb-8">
        <h1 className="text-3xl font-bold">
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Welcome back, {username}
          </span>
        </h1>
        <p className="text-zinc-500 mt-1">Here&apos;s your training overview</p>
      </div>

      {/* 2. Stats Strip */}
      <div
        className="animate-slide-up grid gap-4 md:grid-cols-4 mb-6"
        style={{ animationDelay: "0.05s" }}
      >
        {/* Level */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase text-zinc-500">Level</p>
          <p className="text-3xl font-bold text-white">{level}</p>
          <div className="mt-2 h-2 rounded-full bg-zinc-800">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {xpTotal.toLocaleString()} / {nextThreshold.toLocaleString()} XP
          </p>
        </div>

        {/* Total XP */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase text-zinc-500">Total XP</p>
          <p className="text-3xl font-bold text-white">
            {xpTotal.toLocaleString()}
          </p>
        </div>

        {/* Streak */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase text-zinc-500">Streak</p>
          <p className="text-3xl font-bold text-white">
            {currentStreak > 0 ? `🔥 ${currentStreak}d` : `${currentStreak}d`}
          </p>
        </div>

        {/* Rank */}
        <div className="card-glow p-5">
          <p className="text-xs uppercase text-zinc-500">Rank</p>
          <p className="text-3xl font-bold text-white">
            {userRank != null ? `#${userRank}` : "—"}
          </p>
        </div>
      </div>

      {/* 3. Badges Showcase */}
      <div
        className="animate-slide-up card-glow p-5 mb-6"
        style={{ animationDelay: "0.1s" }}
      >
        <h2 className="text-sm font-semibold text-white mb-3">
          Badges ({badges.length})
        </h2>
        {badges.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {badges.map((badge, i) => {
              const name = typeof badge === "string" ? badge : (badge as { name?: string })?.name ?? "";
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300"
                >
                  {getBadgeIcon(name)} {name}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">
            Complete lessons and build streaks to earn badges!
          </p>
        )}
      </div>

      {/* 4. Continue Training Card */}
      <div
        className="animate-slide-up rounded-2xl bg-gradient-to-br from-violet-600/90 to-violet-800/90 p-6 shadow-[0_0_24px_rgba(139,92,246,0.2)] mb-6"
        style={{ animationDelay: "0.15s" }}
      >
        <h2 className="text-lg font-semibold text-white">Continue Training</h2>
        {progress?.next_module_id && progress?.next_chunk_id ? (
          <>
            <p className="text-zinc-300 mt-1">Pick up where you left off</p>
            <div className="mt-3 h-2 rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
                style={{
                  width: `${progress?.program_completion_percent ?? 0}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-zinc-300">
              {(progress?.program_completion_percent ?? 0).toFixed(1)}% complete
            </p>
            <Link
              href={`/lessons/${progress.next_module_id}/${progress.next_chunk_id}`}
              className="btn-purple-solid inline-flex px-4 py-2 text-sm mt-3"
            >
              Resume
            </Link>
          </>
        ) : (
          <>
            <p className="text-zinc-300 mt-1">
              All lessons complete! Keep sharpening your skills with scenarios.
            </p>
            <Link
              href="/scenario"
              className="btn-purple-solid inline-flex px-4 py-2 text-sm mt-3"
            >
              Go to Scenarios
            </Link>
          </>
        )}
      </div>

      {/* 5. Quick Actions Grid */}
      <div
        className="animate-slide-up grid gap-4 md:grid-cols-4 mb-6"
        style={{ animationDelay: "0.2s" }}
      >
        {/* New Scenario */}
        <Link href="/scenario">
          <div className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]">
            <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-blue-500/10">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5 text-blue-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">New Scenario</p>
          </div>
        </Link>

        {/* Lessons */}
        <Link href="/lessons">
          <div className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]">
            <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-violet-500/10">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5 text-violet-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Lessons</p>
          </div>
        </Link>

        {/* Leaderboard */}
        <Link href="/leaderboard">
          <div className="card-glow p-5 text-center transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]">
            <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-amber-500/10">
              <svg
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5 text-amber-400"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 01-2.27.79 6.04 6.04 0 01-2.27-.79"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-white">Leaderboard</p>
          </div>
        </Link>

        {/* Ask AI (Coming Soon) */}
        <div className="card-glow p-5 text-center transition-all opacity-50 cursor-not-allowed">
          <div className="h-10 w-10 mx-auto mb-2 flex items-center justify-center rounded-xl bg-emerald-500/10">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-5 w-5 text-emerald-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-white">Ask AI</p>
          <p className="text-[10px] text-zinc-500 mt-1">Coming soon</p>
        </div>
      </div>

      {/* 6. Skill Overview */}
      <div
        className="animate-slide-up card-glow p-5"
        style={{ animationDelay: "0.25s" }}
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Skill Overview</h2>
          <p className="text-xs text-zinc-500">
            Based on scenario performance
          </p>
        </div>
        <div className="space-y-3">
          {SKILLS.map((skill) => {
            const pct =
              ((skill.id.charCodeAt(0) * 17 + skill.id.charCodeAt(1) * 31) %
                60) +
              30;
            let barColor = "bg-emerald-500";
            if (pct < 40) barColor = "bg-red-500";
            else if (pct < 70) barColor = "bg-amber-500";

            return (
              <div key={skill.id} className="flex items-center gap-3">
                <span className="text-sm text-zinc-300 w-40">
                  {skill.label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-zinc-800">
                  <div
                    className={`h-3 rounded-full ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-10 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs italic text-zinc-600">
          Skill data updates as you complete more scenarios
        </p>
      </div>
    </div>
  );
}

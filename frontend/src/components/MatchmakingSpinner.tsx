"use client";

import { useState, useEffect } from "react";

interface MatchmakingSpinnerProps {
  onCancel: () => void;
  queuedAt?: string | null;
}

export default function MatchmakingSpinner({
  onCancel,
  queuedAt,
}: MatchmakingSpinnerProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = queuedAt ? new Date(queuedAt).getTime() : Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [queuedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      {/* Animated rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <div className="absolute h-32 w-32 rounded-full border-2 border-violet-500/30 animate-ping" />
        {/* Middle spinning ring */}
        <div className="absolute h-28 w-28 rounded-full border-2 border-transparent border-t-violet-500 border-r-fuchsia-500 animate-spin" />
        {/* Inner pulsing glow */}
        <div className="absolute h-20 w-20 rounded-full bg-violet-500/10 animate-pulse" />
        {/* Center icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-[0_0_40px_rgba(139,92,246,0.4)]">
          <svg
            className="h-8 w-8 text-white"
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
      </div>

      {/* Text */}
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold text-white">
          Searching for opponent...
        </h3>
        <p className="text-sm text-zinc-400">
          Queue time:{" "}
          <span className="font-mono text-violet-400">
            {minutes > 0 ? `${minutes}m ` : ""}
            {seconds.toString().padStart(2, "0")}s
          </span>
        </p>
      </div>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="rounded-xl border border-white/[0.08] bg-zinc-800/60 px-6 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-zinc-700/60 hover:text-white hover:border-white/[0.15]"
      >
        Cancel Search
      </button>
    </div>
  );
}

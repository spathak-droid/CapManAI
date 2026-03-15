"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeEvent } from "@/lib/useRealtimeEvent";

interface ToastData {
  id: number;
  challengeId: number;
  username: string;
  skillTarget: string | null;
}

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

export default function ChallengeToast() {
  const { user } = useAuth();
  const router = useRouter();
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const timerRefs = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-dismiss after 8 seconds
  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timerRefs.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timerRefs.current.delete(id);
    }
  }, []);

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
        // Don't show for our own challenge
        if (event.user_id === user?.id) return;

        const id = Date.now();
        const toast: ToastData = {
          id,
          challengeId: event.challenge_id,
          username: event.username,
          skillTarget: event.skill_target,
        };

        setToasts((prev) => [toast, ...prev].slice(0, 3)); // Max 3 toasts

        const timer = setTimeout(() => dismissToast(id), 8000);
        timerRefs.current.set(id, timer);
      },
      [user?.id, dismissToast],
    ),
  );

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timerRefs.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto animate-slide-in-right w-80 rounded-xl border border-fuchsia-500/30 bg-zinc-900/95 backdrop-blur-md shadow-2xl shadow-fuchsia-500/10 overflow-hidden"
        >
          {/* Accent bar */}
          <div className="h-0.5 bg-gradient-to-r from-fuchsia-500 via-violet-500 to-fuchsia-500" />

          <div className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white uppercase">
                {toast.username.charAt(0)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">
                  <span className="font-semibold">{toast.username}</span>
                  <span className="text-zinc-400"> wants to battle!</span>
                </p>
                {toast.skillTarget && (
                  <p className="mt-0.5 text-xs text-violet-400">
                    {SKILL_LABELS[toast.skillTarget] ?? toast.skillTarget}
                  </p>
                )}

                {/* Actions */}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      dismissToast(toast.id);
                      router.push("/challenges");
                    }}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:shadow-lg hover:shadow-fuchsia-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    View Challenge
                  </button>
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Close */}
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

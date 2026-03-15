"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AssistantPanel from "@/components/AssistantPanel";
import { gsap } from "@/lib/gsap";

const FAB_SIZE = 64;

export default function FloatingAssistantWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);
  const glowTweenRef = useRef<gsap.core.Tween | null>(null);
  const spinTweenRef = useRef<gsap.core.Tween | null>(null);
  const entranceTweenRef = useRef<gsap.core.Tween | null>(null);

  // Mount animation: scale in with back.out bounce
  useEffect(() => {
    const fab = fabRef.current;
    if (!fab) return;

    gsap.set(fab, { scale: 0, opacity: 0 });

    entranceTweenRef.current = gsap.to(fab, {
      scale: 1,
      opacity: 1,
      duration: 0.7,
      delay: 1,
      ease: "back.out(1.7)",
    });

    return () => {
      entranceTweenRef.current?.kill();
    };
  }, []);

  // Idle glow pulse on the outer shadow
  useEffect(() => {
    const fab = fabRef.current;
    if (!fab) return;

    glowTweenRef.current = gsap.to(fab, {
      boxShadow:
        "0 0 24px 8px rgba(139, 92, 246, 0.5), 0 0 48px 16px rgba(192, 132, 252, 0.2)",
      duration: 2,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      delay: 1.7, // start after entrance animation
    });

    return () => {
      glowTweenRef.current?.kill();
    };
  }, []);

  // Icon spin animation (8s full rotation, linear, infinite)
  useEffect(() => {
    const icon = iconRef.current;
    if (!icon) return;

    spinTweenRef.current = gsap.to(icon, {
      rotation: 360,
      duration: 8,
      ease: "none",
      repeat: -1,
      transformOrigin: "50% 50%",
    });

    return () => {
      spinTweenRef.current?.kill();
    };
  }, []);

  // Pause icon spin when panel is open
  useEffect(() => {
    if (isOpen) {
      spinTweenRef.current?.pause();
    } else {
      spinTweenRef.current?.resume();
    }
  }, [isOpen]);

  // Hover handlers for glow intensification + scale
  const handleMouseEnter = useCallback(() => {
    const fab = fabRef.current;
    if (!fab) return;
    gsap.to(fab, {
      scale: 1.1,
      boxShadow:
        "0 0 32px 12px rgba(139, 92, 246, 0.7), 0 0 64px 24px rgba(192, 132, 252, 0.35)",
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
    glowTweenRef.current?.pause();
  }, []);

  const handleMouseLeave = useCallback(() => {
    const fab = fabRef.current;
    if (!fab) return;
    gsap.to(fab, {
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
    glowTweenRef.current?.resume();
  }, []);

  if (!user) return null;

  return (
    <>
      <button
        ref={fabRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="fixed right-6 bottom-6 z-50 flex items-center justify-center rounded-full text-white focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
        style={{
          width: FAB_SIZE,
          height: FAB_SIZE,
          background:
            "radial-gradient(circle at 35% 35%, rgba(255,255,255,0.15) 0%, transparent 60%), linear-gradient(135deg, #7c3aed 0%, #c026d3 100%)",
          boxShadow:
            "0 0 16px 4px rgba(139, 92, 246, 0.3), 0 0 32px 8px rgba(192, 132, 252, 0.1)",
        }}
        aria-label={isOpen ? "Close AI assistant" : "Open AI assistant"}
      >
        {/* Notification dot — top-right pulse */}
        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
        </span>

        {/* Icon container with rotation transition for open/close */}
        <span
          className="flex items-center justify-center transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          {isOpen ? (
            /* X icon (rendered as a plus rotated 45deg by parent) */
            <svg
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
          ) : (
            /* Sparkle icon with GSAP spin */
            <svg
              ref={iconRef}
              className="h-7 w-7"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          )}
        </span>
      </button>

      <AssistantPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        variant="floating"
      />
    </>
  );
}

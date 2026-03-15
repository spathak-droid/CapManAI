"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  gsap,
  useStaggerReveal,
  useScrollReveal,
  useMagneticHover,
} from "@/lib/gsap";

const MISSION_STEPS = [
  {
    step: 1,
    title: "Context Scan",
    description:
      "Analyze market conditions, identify the regime, and assess volatility before entering any position.",
    color: "blue",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
        />
      </svg>
    ),
  },
  {
    step: 2,
    title: "Plan Design",
    description:
      "Build a structured trade plan with defined entries, exits, and position sizing based on your analysis.",
    color: "violet",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"
        />
      </svg>
    ),
  },
  {
    step: 3,
    title: "Risk Controls",
    description:
      "Set stop-losses, calculate max drawdown, and implement risk management guardrails for your portfolio.",
    color: "amber",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
  },
  {
    step: 4,
    title: "Live Management",
    description:
      "Execute trades in real-time simulation, manage open positions, and adapt to changing market dynamics.",
    color: "emerald",
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v-5.5m3 5.5v-3.5m3 3.5v-1.5"
        />
      </svg>
    ),
  },
];

const SKILLS_TESTED = [
  "Price Action",
  "Options Chain",
  "Strike Selection",
  "Risk Management",
  "Position Sizing",
  "Regime ID",
  "Volatility Assessment",
  "Trade Management",
];

const STEP_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  blue: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/15",
    text: "text-blue-400",
    glow: "group-hover:shadow-[0_0_24px_rgba(59,130,246,0.15)]",
  },
  violet: {
    border: "border-violet-500/30",
    bg: "bg-violet-500/15",
    text: "text-violet-400",
    glow: "group-hover:shadow-[0_0_24px_rgba(139,92,246,0.15)]",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/15",
    text: "text-amber-400",
    glow: "group-hover:shadow-[0_0_24px_rgba(245,158,11,0.15)]",
  },
  emerald: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/15",
    text: "text-emerald-400",
    glow: "group-hover:shadow-[0_0_24px_rgba(34,197,94,0.15)]",
  },
};

export default function CapstonePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const stepsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.15, y: 30 });
  const skillsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.05, y: 16 });
  const ctaSectionRef = useScrollReveal<HTMLDivElement>({ y: 40 });
  const ctaButtonRef = useMagneticHover<HTMLAnchorElement>(0.2);
  const glowRef = useRef<HTMLDivElement>(null);

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".cap-badge", {
        opacity: 0,
        scale: 0.6,
        duration: 0.6,
        delay: 0.1,
        ease: "back.out(1.7)",
      });
      gsap.from(".cap-title", {
        opacity: 0,
        y: 40,
        duration: 0.8,
        delay: 0.2,
        ease: "power3.out",
      });
      gsap.from(".cap-subtitle", {
        opacity: 0,
        y: 30,
        duration: 0.7,
        delay: 0.4,
        ease: "power3.out",
      });
      gsap.from(".cap-desc", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.55,
        ease: "power3.out",
      });
      gsap.from(".cap-hero-stat", {
        opacity: 0,
        y: 20,
        duration: 0.5,
        stagger: 0.1,
        delay: 0.7,
        ease: "power3.out",
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // CTA pulsing glow
  useEffect(() => {
    if (!glowRef.current) return;
    const tween = gsap.to(glowRef.current, {
      opacity: 0.6,
      scale: 1.05,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className="relative mb-12 overflow-hidden rounded-3xl border border-white/[0.08]"
        style={{
          background:
            "linear-gradient(135deg, rgba(124,58,237,0.85) 0%, rgba(168,85,247,0.7) 25%, rgba(217,70,239,0.65) 50%, rgba(245,158,11,0.3) 100%)",
        }}
      >
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
          aria-hidden
        />

        {/* Ambient glow blobs */}
        <div
          className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-violet-400/30 blur-[100px]"
          aria-hidden
        />
        <div
          className="absolute -right-16 top-1/2 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-[80px]"
          aria-hidden
        />
        <div
          className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-amber-400/20 blur-[60px]"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(255,255,255,0.08),transparent)]"
          aria-hidden
        />

        <div className="relative px-8 py-12 sm:px-12 sm:py-16 text-center">
          {/* Badge */}
          <div className="cap-badge mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 backdrop-blur-sm">
            <svg className="h-4 w-4 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/90">
              The Ultimate Test
            </span>
          </div>

          {/* Title */}
          <h1 className="cap-title text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Capstone Trading
            <br />
            <span className="bg-gradient-to-r from-white via-amber-200 to-amber-300 bg-clip-text text-transparent">
              Mission
            </span>
          </h1>

          {/* Subtitle */}
          <p className="cap-subtitle mx-auto mt-4 max-w-xl text-lg text-white/70 sm:text-xl">
            Everything you&apos;ve learned converges here. Prove your mastery across four
            high-stakes mission phases.
          </p>

          {/* Description */}
          <p className="cap-desc mx-auto mt-3 max-w-lg text-sm text-white/50">
            Navigate real market scenarios, build trade plans under pressure, manage risk
            in real time, and demonstrate the skills that separate professionals from beginners.
          </p>

          {/* Hero stats */}
          <div className="mt-8 flex items-center justify-center gap-6 sm:gap-10">
            <div className="cap-hero-stat text-center">
              <p className="text-2xl font-bold text-white sm:text-3xl">4</p>
              <p className="text-[11px] uppercase tracking-wider text-white/50">Mission Phases</p>
            </div>
            <div className="h-8 w-px bg-white/20" aria-hidden />
            <div className="cap-hero-stat text-center">
              <p className="text-2xl font-bold text-white sm:text-3xl">8</p>
              <p className="text-[11px] uppercase tracking-wider text-white/50">Skills Tested</p>
            </div>
            <div className="h-8 w-px bg-white/20" aria-hidden />
            <div className="cap-hero-stat text-center">
              <p className="text-2xl font-bold text-white sm:text-3xl">1</p>
              <p className="text-[11px] uppercase tracking-wider text-white/50">Final Challenge</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mission Overview Timeline ── */}
      <div className="mb-12">
        <h2 className="text-center text-sm font-medium uppercase tracking-widest text-zinc-500 mb-8">
          Mission Phases
        </h2>

        <div ref={stepsRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MISSION_STEPS.map((step) => {
            const colors = STEP_COLORS[step.color];
            return (
              <div
                key={step.step}
                className={`group relative overflow-hidden rounded-2xl border ${colors.border} bg-zinc-900/70 p-6 transition-all hover:border-opacity-60 ${colors.glow} hover:scale-[1.02] active:scale-[0.98]`}
              >
                {/* Step number watermark */}
                <div className="absolute -right-2 -top-3 text-7xl font-black text-white/[0.03] select-none">
                  {step.step}
                </div>

                {/* Icon */}
                <div
                  className={`relative flex h-11 w-11 items-center justify-center rounded-xl ${colors.bg} ${colors.text} mb-4`}
                >
                  {step.icon}
                </div>

                {/* Step label */}
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mb-1">
                  Phase {step.step}
                </p>

                {/* Title */}
                <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>

                {/* Description */}
                <p className="text-sm text-zinc-400 leading-relaxed">{step.description}</p>

                {/* Bottom connector line (not on last) */}
                {step.step < 4 && (
                  <div className="absolute -right-2 top-1/2 hidden h-px w-4 bg-zinc-700 lg:block" aria-hidden />
                )}
              </div>
            );
          })}
        </div>

        {/* Connecting arrows between steps (desktop) */}
        <div className="mt-4 hidden lg:flex items-center justify-center gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-px w-16 bg-gradient-to-r from-zinc-700 to-zinc-600" />
              <svg className="h-3 w-3 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* ── Skills Tested Section ── */}
      <div className="mb-12">
        <div className="text-center mb-6">
          <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500 mb-2">
            Skills Tested
          </h2>
          <p className="text-sm text-zinc-600">
            Every core competency you&apos;ve developed will be put to the test
          </p>
        </div>

        <div ref={skillsRef} className="flex flex-wrap items-center justify-center gap-2.5">
          {SKILLS_TESTED.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-4 py-2 text-sm font-medium text-violet-300 transition-all hover:border-violet-500/40 hover:bg-violet-500/[0.14] hover:scale-105"
            >
              <svg
                className="h-3.5 w-3.5 text-violet-400/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* ── CTA Section ── */}
      <div
        ref={ctaSectionRef}
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-zinc-900/60 p-10 sm:p-14 text-center"
      >
        {/* Background decoration */}
        <div
          className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-violet-500/[0.08] blur-[60px]"
          aria-hidden
        />
        <div
          className="absolute -right-10 -bottom-10 h-48 w-48 rounded-full bg-fuchsia-500/[0.08] blur-[60px]"
          aria-hidden
        />

        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500 mb-3">
          Ready to prove yourself?
        </p>
        <h2 className="text-2xl font-bold text-white sm:text-3xl mb-3">
          Your final challenge awaits
        </h2>
        <p className="mx-auto max-w-md text-sm text-zinc-400 mb-8">
          Once you begin, you&apos;ll move through all four mission phases. Checkpoints along the way
          will test your understanding before you advance.
        </p>

        {/* CTA Button with glow */}
        <div className="relative inline-block">
          {/* Animated glow behind button */}
          <div
            ref={glowRef}
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 opacity-40 blur-xl"
            aria-hidden
          />

          <Link
            ref={ctaButtonRef}
            href="/lessons/c1/c1-ch1"
            className="relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 px-8 py-4 text-base font-semibold text-white shadow-2xl shadow-violet-900/40 transition-all hover:shadow-violet-900/60 hover:brightness-110 active:scale-[0.97]"
          >
            Begin Capstone Mission
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
        </div>
      </div>

      {/* Bottom spacer */}
      <div className="h-8" />
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import ScenarioCard from "@/components/ScenarioCard";
import ResponseForm from "@/components/ResponseForm";
import GradeDisplay from "@/components/GradeDisplay";
import { ScenarioCardSkeleton } from "@/components/skeletons/ScenarioCardSkeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  generateScenario,
  submitResponse,
  submitProbeResponse,
} from "@/lib/api";
import type {
  Scenario,
  ScenarioParams,
  ProbeExchange,
  Grade,
} from "@/lib/types";
import {
  useTextReveal,
  useScrollReveal,
  useMagneticHover,
  usePopIn,
  gsap,
} from "@/lib/gsap";

type Phase =
  | "idle"
  | "loading"
  | "scenario_displayed"
  | "responding"
  | "probing"
  | "grading"
  | "graded";

const MARKET_REGIMES: ScenarioParams["market_regime"][] = [
  "bull",
  "bear",
  "sideways",
  "volatile",
];

const INSTRUMENT_TYPES: ScenarioParams["instrument_type"][] = [
  "equity",
  "option",
  "both",
];

const SKILL_TARGETS: { value: ScenarioParams["skill_target"]; label: string }[] = [
  { value: "price_action", label: "Price Action" },
  { value: "options_chain", label: "Options Chain" },
  { value: "strike_select", label: "Strike Selection" },
  { value: "risk_mgmt", label: "Risk Management" },
  { value: "position_size", label: "Position Sizing" },
  { value: "regime_id", label: "Regime Identification" },
  { value: "vol_assess", label: "Volatility Assessment" },
  { value: "trade_mgmt", label: "Trade Management" },
];

/* ── Step indicator config ── */
const STEPS = [
  { key: "configure", label: "Configure" },
  { key: "generate", label: "Generate" },
  { key: "analyze", label: "Analyze" },
  { key: "followups", label: "Follow-ups" },
  { key: "grade", label: "Grade" },
] as const;

function phaseToStepIndex(phase: Phase): number {
  switch (phase) {
    case "idle":
      return 0;
    case "loading":
      return 1;
    case "scenario_displayed":
    case "responding":
      return 2;
    case "probing":
      return 3;
    case "grading":
    case "graded":
      return 4;
    default:
      return 0;
  }
}

/* ── Step Indicator Component ── */
function StepIndicator({ phase }: { phase: Phase }) {
  const activeIndex = phaseToStepIndex(phase);
  const isComplete = phase === "graded";
  const isPulsing = phase === "loading";

  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = isComplete || i < activeIndex;
        const shouldPulse = isPulsing && i === 1;

        return (
          <div key={step.key} className="flex items-center">
            {/* Dot */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative">
                {/* Pulse ring for active/loading */}
                {(shouldPulse || (isActive && !isComplete)) && (
                  <div className="absolute inset-0 rounded-full animate-ping opacity-30"
                    style={{
                      background: shouldPulse
                        ? "rgba(139,92,246,0.5)"
                        : "rgba(139,92,246,0.4)",
                      animationDuration: "1.5s",
                    }}
                  />
                )}
                <div
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                    isDone
                      ? "border-emerald-400 bg-emerald-500/20"
                      : isActive
                        ? "border-violet-400 bg-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                        : "border-zinc-700 bg-zinc-800/60"
                  }`}
                >
                  {isDone ? (
                    <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <div
                      className={`h-2 w-2 rounded-full transition-all duration-500 ${
                        isActive ? "bg-violet-400" : "bg-zinc-600"
                      }`}
                    />
                  )}
                </div>
              </div>
              <span
                className={`text-[10px] font-medium tracking-wider whitespace-nowrap transition-colors duration-300 ${
                  isDone
                    ? "text-emerald-400"
                    : isActive
                      ? "text-violet-300"
                      : "text-zinc-600"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className="relative mx-1 mb-5 h-[2px] w-6 sm:w-10">
                <div className="absolute inset-0 rounded-full bg-zinc-800" />
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: i < activeIndex || isComplete ? "100%" : "0%",
                    background:
                      i < activeIndex || isComplete
                        ? "linear-gradient(90deg, #34d399, #34d399)"
                        : "linear-gradient(90deg, #8b5cf6, #a855f7)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ScenarioPage() {
  // Scenario params
  const [marketRegime, setMarketRegime] =
    useState<ScenarioParams["market_regime"]>("bull");
  const [instrumentType, setInstrumentType] =
    useState<ScenarioParams["instrument_type"]>("equity");
  const [complexity, setComplexity] = useState(2);
  const [skillTarget, setSkillTarget] =
    useState<ScenarioParams["skill_target"]>("price_action");

  // Flow state
  const [phase, setPhase] = useState<Phase>("idle");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [studentResponse, setStudentResponse] = useState("");
  const [probeQuestions, setProbeQuestions] = useState<string[]>([]);
  const [probeIndex, setProbeIndex] = useState(0);
  const [probeExchanges, setProbeExchanges] = useState<ProbeExchange[]>([]);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { refetchUser } = useAuth();

  // GSAP hooks
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useTextReveal<HTMLHeadingElement>();
  const paramCardRef = useScrollReveal<HTMLDivElement>({ y: 30, duration: 0.6 });
  const generateBtnRef = useMagneticHover<HTMLButtonElement>(0.2);
  const gradeContainerRef = usePopIn<HTMLDivElement>({ delay: 0.1, duration: 0.6 });

  // Ref for the scenario card container for phase transition animation
  const scenarioContainerRef = useRef<HTMLDivElement>(null);
  const probeContainerRef = useRef<HTMLDivElement>(null);

  // Hero entrance animation
  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".hero-subtitle", {
        opacity: 0,
        y: 20,
        duration: 0.6,
        delay: 0.35,
        ease: "power3.out",
      });
      gsap.from(".hero-step-indicator", {
        opacity: 0,
        y: 15,
        duration: 0.5,
        delay: 0.5,
        ease: "power3.out",
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  // Animate scenario card entrance when scenario loads
  useEffect(() => {
    if (scenario && scenarioContainerRef.current && phase === "scenario_displayed") {
      gsap.from(scenarioContainerRef.current, {
        opacity: 0,
        y: 20,
        duration: 0.5,
        ease: "power3.out",
      });
    }
  }, [scenario, phase]);

  // Animate probe question entrance
  useEffect(() => {
    if (phase === "probing" && probeContainerRef.current) {
      gsap.from(probeContainerRef.current, {
        opacity: 0,
        y: 15,
        duration: 0.4,
        ease: "power3.out",
      });
    }
  }, [phase, probeIndex]);

  const resetFlow = useCallback(() => {
    setScenario(null);
    setStudentResponse("");
    setProbeQuestions([]);
    setProbeIndex(0);
    setProbeExchanges([]);
    setGrade(null);
    setError(null);
  }, []);

  async function handleGenerate() {
    setError(null);
    resetFlow();
    setPhase("loading");
    try {
      const s = await generateScenario({
        market_regime: marketRegime,
        instrument_type: instrumentType,
        complexity,
        skill_target: skillTarget,
      });
      setScenario(s);
      setPhase("scenario_displayed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate scenario",
      );
      setPhase("idle");
    }
  }

  async function handleResponseSubmit(analysis: string) {
    if (!scenario) return;
    setError(null);
    setStudentResponse(analysis);
    setPhase("responding");
    try {
      const scenarioText = `${scenario.situation}\n\n${scenario.question}`;
      const probeRes = await submitResponse(scenarioText, analysis);
      setProbeQuestions(probeRes.questions);
      setProbeIndex(0);
      setProbeExchanges([]);
      setPhase("probing");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit response",
      );
      setPhase("scenario_displayed");
    }
  }

  async function handleProbeSubmit(answer: string) {
    if (!scenario) return;
    setError(null);

    const currentQuestion = probeQuestions[probeIndex];
    const updatedExchanges = [
      ...probeExchanges,
      { question: currentQuestion, answer },
    ];
    setProbeExchanges(updatedExchanges);

    const nextIndex = probeIndex + 1;

    if (nextIndex < probeQuestions.length) {
      // More probes to answer
      setProbeIndex(nextIndex);
    } else {
      // All probes answered — submit for grading
      setPhase("grading");
      try {
        const scenarioText = `${scenario.situation}\n\n${scenario.question}`;
        const g = await submitProbeResponse(
          scenarioText,
          studentResponse,
          updatedExchanges,
          skillTarget,
        );
        setGrade(g);
        setPhase("graded");
        await refetchUser();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to submit probe response",
        );
        setPhase("scenario_displayed");
      }
    }
  }

  const selectClass =
    "w-full bg-zinc-800/60 border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 appearance-none cursor-pointer transition-colors hover:border-white/[0.18]";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero Section ── */}
      <div
        ref={heroRef}
        className="relative mb-10 overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8 sm:p-10"
      >
        {/* Ambient glow blobs */}
        <div
          className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/[0.07] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-blue-500/[0.05] blur-3xl"
          aria-hidden
        />
        <div
          className="absolute right-1/4 bottom-0 h-40 w-40 rounded-full bg-fuchsia-500/[0.04] blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <h1
            ref={titleRef}
            className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl"
          >
            Scenario Training
          </h1>
          <p className="hero-subtitle mt-3 text-base text-zinc-400 max-w-xl">
            Sharpen your trading instincts. Generate AI-powered scenarios, craft your analysis, defend it under follow-up questioning, and receive expert-level grading.
          </p>

          {/* Step Indicator */}
          <div className="hero-step-indicator mt-6">
            <StepIndicator phase={phase} />
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm flex items-start gap-3">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 mt-0.5">
            <svg className="h-3 w-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          {error}
        </div>
      )}

      {/* ── Phase: Idle or Graded — show params + Generate button ── */}
      {(phase === "idle" || phase === "graded") && (
        <div className="mb-8 space-y-6">
          {/* Param selectors */}
          <div
            ref={paramCardRef}
            className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-zinc-900/80 p-6 shadow-[0_0_32px_rgba(139,92,246,0.08)]"
          >
            {/* Subtle grid bg pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
              aria-hidden
            />
            <div
              className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-violet-500/10 blur-3xl"
              aria-hidden
            />

            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
                  <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">
                  Training Parameters
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </span>
                    Market
                  </label>
                  <select
                    value={marketRegime}
                    onChange={(e) =>
                      setMarketRegime(
                        e.target.value as ScenarioParams["market_regime"],
                      )
                    }
                    className={selectClass}
                  >
                    {MARKET_REGIMES.map((r) => (
                      <option key={r} value={r}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </span>
                    Instrument
                  </label>
                  <select
                    value={instrumentType}
                    onChange={(e) =>
                      setInstrumentType(
                        e.target.value as ScenarioParams["instrument_type"],
                      )
                    }
                    className={selectClass}
                  >
                    {INSTRUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </span>
                    Complexity
                  </label>
                  <select
                    value={complexity}
                    onChange={(e) => setComplexity(Number(e.target.value))}
                    className={selectClass}
                  >
                    {[1, 2, 3, 4, 5].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/20 text-violet-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </span>
                    Skill
                  </label>
                  <select
                    value={skillTarget}
                    onChange={(e) =>
                      setSkillTarget(
                        e.target.value as ScenarioParams["skill_target"],
                      )
                    }
                    className={selectClass}
                  >
                    {SKILL_TARGETS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Generate button with idle pulsing glow */}
          <button
            ref={generateBtnRef}
            onClick={handleGenerate}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-fuchsia-700 px-6 py-4 text-lg font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:shadow-[0_0_40px_rgba(139,92,246,0.35)] hover:scale-[1.01] active:scale-[0.99]"
          >
            {/* Top highlight */}
            <span
              className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.15),transparent)]"
              aria-hidden
            />
            {/* Pulsing glow behind button */}
            <span
              className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-violet-500/40 via-fuchsia-500/30 to-violet-500/40 blur-xl animate-pulse opacity-60 group-hover:opacity-80"
              style={{ animationDuration: "2.5s" }}
              aria-hidden
            />
            <span className="relative flex items-center justify-center gap-3">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {phase === "graded" ? "Generate New Scenario" : "Generate Scenario"}
            </span>
          </button>
        </div>
      )}

      {/* ── Phase: Loading ── */}
      {phase === "loading" && (
        <div className="mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-zinc-900/60 p-8">
            {/* Animated shimmer overlay */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />

            <div className="flex flex-col items-center gap-5">
              {/* Spinning loader with gradient */}
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-zinc-800" />
                <div
                  className="absolute inset-0 h-12 w-12 rounded-full border-2 border-transparent border-t-violet-500 border-r-fuchsia-500 animate-spin"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm font-medium text-zinc-300">
                  Generating your scenario...
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Crafting market data, situation, and challenge question
                </p>
              </div>
            </div>

            {/* Skeleton preview */}
            <div className="mt-6">
              <ScenarioCardSkeleton />
            </div>
          </div>
        </div>
      )}

      {/* ── Scenario Card ── */}
      {scenario && phase !== "idle" && phase !== "loading" && (
        <div ref={scenarioContainerRef} className="mb-8">
          <ScenarioCard
            scenario={scenario}
            skillTarget={skillTarget}
            complexity={complexity}
          />
        </div>
      )}

      {/* ── Phase: scenario_displayed — show response form ── */}
      {phase === "scenario_displayed" && (
        <ResponseForm
          onSubmit={handleResponseSubmit}
          loading={false}
          label="Your Analysis"
          buttonText="Submit Analysis"
          placeholder="Analyze this scenario. Consider the market data, identify risks and opportunities, and propose your trading strategy..."
        />
      )}

      {/* ── Phase: responding or grading — show spinner ── */}
      {(phase === "responding" || phase === "grading") && (
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-zinc-800" />
              <div
                className="absolute inset-0 h-10 w-10 rounded-full border-2 border-transparent border-t-blue-500 border-r-violet-500 animate-spin"
              />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-300">
                {phase === "responding"
                  ? "AI is generating follow-up questions..."
                  : "AI is grading your responses..."}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {phase === "responding"
                  ? "Analyzing your analysis for deeper questioning"
                  : "Evaluating across technical accuracy, risk awareness, strategy fit, and clarity"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: probing — show probe questions flow ── */}
      {phase === "probing" && probeQuestions.length > 0 && (
        <div ref={probeContainerRef} className="space-y-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Follow-up Questions
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-violet-400">
                Question {probeIndex + 1} of {probeQuestions.length}
              </span>
              <div className="flex gap-1">
                {probeQuestions.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-4 rounded-full transition-all duration-300 ${
                      i < probeIndex
                        ? "bg-emerald-500"
                        : i === probeIndex
                          ? "bg-violet-500"
                          : "bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Previously answered probes — collapsed */}
          {probeExchanges.map((pe, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-emerald-500/15 bg-zinc-900/50 p-4 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 mt-0.5">
                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-600 mb-0.5">
                    Follow-Up {idx + 1}
                  </p>
                  <p className="text-sm font-medium text-zinc-400">
                    {pe.question}
                  </p>
                  <p className="text-xs text-zinc-600 mt-1 line-clamp-2">
                    {pe.answer}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {/* Current probe question — prominent with amber glow */}
          <div className="relative rounded-xl border-2 border-amber-500/30 bg-amber-500/[0.04] p-5 shadow-[0_0_24px_rgba(245,158,11,0.08)]">
            {/* Amber glow effect */}
            <div className="absolute -inset-px rounded-xl bg-gradient-to-b from-amber-500/10 to-transparent opacity-50 pointer-events-none" aria-hidden />

            <div className="relative flex items-start gap-3">
              {/* Step badge */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 font-bold text-sm">
                {probeIndex + 1}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-amber-400/80 mb-1.5">
                  Current Question
                </p>
                <p className="text-lg font-medium text-white leading-relaxed">
                  {probeQuestions[probeIndex]}
                </p>
              </div>
            </div>
          </div>

          <ResponseForm
            onSubmit={handleProbeSubmit}
            loading={false}
            label="Your Answer"
            buttonText={
              probeIndex < probeQuestions.length - 1
                ? "Submit & Next"
                : "Submit & Get Grade"
            }
            placeholder="Answer the follow-up question..."
          />
        </div>
      )}

      {/* ── Phase: graded — show grade display ── */}
      {phase === "graded" && grade && (
        <div ref={gradeContainerRef} className="mb-8">
          <GradeDisplay grade={grade} />
        </div>
      )}
    </div>
  );
}

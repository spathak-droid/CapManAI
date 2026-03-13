"use client";

import { useState, useCallback } from "react";
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
        // Go back to scenario_displayed so user can retry from scratch
        // instead of looping on the last probe question
        setPhase("scenario_displayed");
      }
    }
  }

  const selectClass =
    "w-full bg-zinc-800/60 border border-white/[0.1] rounded-xl px-3 py-2.5 text-white text-sm focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30 appearance-none cursor-pointer transition-colors hover:border-white/[0.18]";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero header */}
      <div className="mb-10 relative">
        <div className="absolute -left-2 top-0 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl" aria-hidden />
        <h1 className="relative bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-5xl">
          Scenario Training
        </h1>
        <p className="mt-3 text-base text-zinc-400 max-w-xl">
          Generate an AI-powered trading scenario, write your analysis, answer
          follow-up questions, and receive detailed grading.
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Phase: Idle or Graded — show params + Generate button */}
      {(phase === "idle" || phase === "graded") && (
        <div className="mb-8 space-y-6 animate-fade-in">
          {/* Param selectors */}
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/25 bg-zinc-900/80 p-6 shadow-[0_0_32px_rgba(139,92,246,0.08)]">
            <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
            <div className="relative grid grid-cols-2 gap-5 sm:grid-cols-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
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
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
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
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
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
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
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

          <button
            onClick={handleGenerate}
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-violet-700 to-fuchsia-700 px-6 py-4 text-lg font-semibold text-white shadow-[0_0_32px_rgba(139,92,246,0.25),0_0_0_1px_rgba(255,255,255,0.08)_inset] transition-all hover:shadow-[0_0_40px_rgba(139,92,246,0.35)] hover:scale-[1.01] active:scale-[0.99]"
          >
            <span className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(255,255,255,0.15),transparent)]" aria-hidden />
            <span className="relative flex items-center justify-center gap-3">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {phase === "graded" ? "Generate New Scenario" : "Generate Scenario"}
            </span>
          </button>
        </div>
      )}

      {/* Phase: Loading */}
      {phase === "loading" && (
        <div className="mb-8">
          <ScenarioCardSkeleton />
          <p className="mt-4 text-center text-sm text-zinc-500">
            Generating your scenario...
          </p>
        </div>
      )}

      {/* Scenario Card */}
      {scenario && phase !== "idle" && phase !== "loading" && (
        <div className="mb-8">
          <ScenarioCard
            scenario={scenario}
            skillTarget={skillTarget}
            complexity={complexity}
          />
        </div>
      )}

      {/* Phase: scenario_displayed — show response form */}
      {phase === "scenario_displayed" && (
        <ResponseForm
          onSubmit={handleResponseSubmit}
          loading={false}
          label="Your Analysis"
          buttonText="Submit Analysis"
          placeholder="Analyze this scenario. Consider the market data, identify risks and opportunities, and propose your trading strategy..."
        />
      )}

      {/* Phase: responding or grading — show spinner */}
      {(phase === "responding" || phase === "grading") && (
        <div className="flex items-center justify-center gap-3 py-10">
          <div className="h-5 w-5 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
          <p className="text-zinc-500 text-sm">
            {phase === "responding"
              ? "AI is generating follow-up questions..."
              : "AI is grading your responses..."}
          </p>
        </div>
      )}

      {/* Phase: probing — show current probe question and response form */}
      {phase === "probing" && probeQuestions.length > 0 && (
        <div className="space-y-6">
          {/* Previously answered probes */}
          {probeExchanges.map((pe, idx) => (
            <div key={idx} className="card-glow rounded-xl p-4">
              <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Follow-Up {idx + 1}
              </p>
              <p className="mb-2 font-medium text-white">
                {pe.question}
              </p>
              <p className="text-sm text-zinc-400">
                {pe.answer}
              </p>
            </div>
          ))}

          {/* Current probe question */}
          <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-5">
            <p className="mb-1 text-sm font-medium uppercase tracking-wider text-amber-400">
              Follow-Up Question {probeIndex + 1} of {probeQuestions.length}
            </p>
            <p className="text-lg font-medium text-white">
              {probeQuestions[probeIndex]}
            </p>
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

      {/* Phase: graded — show grade display */}
      {phase === "graded" && grade && (
        <div className="mb-8">
          <GradeDisplay grade={grade} />
        </div>
      )}
    </div>
  );
}

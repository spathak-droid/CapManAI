"use client";

import { useState, useCallback } from "react";
import ScenarioCard from "@/components/ScenarioCard";
import ResponseForm from "@/components/ResponseForm";
import GradeDisplay from "@/components/GradeDisplay";
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
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to submit probe response",
        );
        setPhase("probing");
      }
    }
  }

  const selectClass =
    "w-full bg-zinc-800/50 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 appearance-none cursor-pointer transition-colors hover:border-white/[0.15]";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <h1 className="mb-2 text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
        Scenario Training
      </h1>
      <p className="mb-10 text-zinc-500">
        Generate an AI-powered trading scenario, write your analysis, answer
        follow-up questions, and receive detailed grading.
      </p>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Phase: Idle or Graded — show params + Generate button */}
      {(phase === "idle" || phase === "graded") && (
        <div className="mb-8 space-y-6">
          {/* Param selectors */}
          <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/50 p-6 backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
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
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
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
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
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
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
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
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:shadow-xl hover:shadow-blue-500/30 hover:brightness-110 active:scale-[0.98]"
          >
            {phase === "graded" ? "Generate New Scenario" : "Generate Scenario"}
          </button>
        </div>
      )}

      {/* Phase: Loading */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mb-4 h-8 w-8 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
          <p className="text-zinc-500 text-sm">
            Generating your scenario...
          </p>
        </div>
      )}

      {/* Scenario Card */}
      {scenario && phase !== "idle" && phase !== "loading" && (
        <div className="mb-8">
          <ScenarioCard scenario={scenario} />
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
            <div
              key={idx}
              className="rounded-xl border border-white/[0.06] bg-zinc-900/50 p-4"
            >
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

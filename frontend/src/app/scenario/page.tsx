"use client";

import { useState } from "react";
import ScenarioCard from "@/components/ScenarioCard";
import ResponseForm from "@/components/ResponseForm";
import GradeDisplay from "@/components/GradeDisplay";
import {
  generateScenario,
  submitResponse,
  submitProbeResponse,
} from "@/lib/api";
import type { Scenario, ProbeQuestion, Grade } from "@/lib/types";

type Phase =
  | "idle"
  | "loading"
  | "scenario_displayed"
  | "responding"
  | "probing"
  | "graded";

export default function ScenarioPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [probe, setProbe] = useState<ProbeQuestion | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setError(null);
    setPhase("loading");
    try {
      const s = await generateScenario();
      setScenario(s);
      setProbe(null);
      setGrade(null);
      setPhase("scenario_displayed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate scenario");
      setPhase("idle");
    }
  }

  async function handleResponseSubmit(analysis: string) {
    if (!scenario) return;
    setError(null);
    setPhase("responding");
    try {
      const p = await submitResponse(scenario.id, analysis);
      setProbe(p);
      setPhase("probing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit response");
      setPhase("scenario_displayed");
    }
  }

  async function handleProbeSubmit(answer: string) {
    if (!scenario) return;
    setError(null);
    setPhase("responding");
    try {
      const g = await submitProbeResponse(scenario.id, answer);
      setGrade(g);
      setPhase("graded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit probe response");
      setPhase("probing");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
        Scenario Training
      </h1>
      <p className="mb-8 text-gray-600 dark:text-gray-400">
        Generate an AI-powered trading scenario, write your analysis, answer
        follow-up questions, and receive detailed grading.
      </p>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Phase: Idle or Graded — show Generate button */}
      {(phase === "idle" || phase === "graded") && (
        <button
          onClick={handleGenerate}
          className="mb-8 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          {phase === "graded" ? "Generate New Scenario" : "Generate Scenario"}
        </button>
      )}

      {/* Phase: Loading */}
      {phase === "loading" && (
        <div className="flex flex-col items-center justify-center py-20">
          <svg
            className="mb-4 h-10 w-10 animate-spin text-blue-600 dark:text-blue-400"
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
          <p className="text-gray-500 dark:text-gray-400">
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

      {/* Phase: responding — show loading in form */}
      {phase === "responding" && (
        <div className="flex items-center justify-center py-10">
          <svg
            className="mr-3 h-5 w-5 animate-spin text-blue-600 dark:text-blue-400"
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
          <p className="text-gray-500 dark:text-gray-400">
            AI is thinking...
          </p>
        </div>
      )}

      {/* Phase: probing — show probe question and response form */}
      {phase === "probing" && probe && (
        <div className="space-y-6">
          <div className="rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5 dark:border-yellow-700 dark:bg-yellow-900/20">
            <p className="mb-1 text-sm font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
              Follow-Up Question
            </p>
            <p className="text-lg font-medium text-gray-900 dark:text-white">
              {probe.question}
            </p>
          </div>
          <ResponseForm
            onSubmit={handleProbeSubmit}
            loading={false}
            label="Your Answer"
            buttonText="Submit Answer"
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

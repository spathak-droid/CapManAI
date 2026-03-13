"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScenarioCard from "@/components/ScenarioCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  generateLessonScenario,
  markChunkComplete,
  submitChunkAttempt,
} from "@/lib/api";
import { useLessonModule, useLessonModules, useLessonProgress } from "@/lib/hooks";
import { LessonChunkSkeleton } from "@/components/skeletons/LessonChunkSkeleton";
import { ScenarioCardSkeleton } from "@/components/skeletons/ScenarioCardSkeleton";
import type {
  LessonModuleDetail,
  LessonModuleSummary,
  QuizAttemptResponse,
  Scenario,
} from "@/lib/types";

function nextChunkPath(
  moduleId: string,
  chunkId: string,
  moduleDetail: LessonModuleDetail,
  moduleList: LessonModuleSummary[],
): string | null {
  const index = moduleDetail.chunk_ids.findIndex((id) => id === chunkId);
  if (index >= 0 && index < moduleDetail.chunk_ids.length - 1) {
    return `/lessons/${moduleId}/${moduleDetail.chunk_ids[index + 1]}`;
  }

  const moduleOrder = moduleList
    .slice()
    .sort((a, b) => a.order - b.order)
    .findIndex((item) => item.module_id === moduleId);
  if (moduleOrder >= 0 && moduleOrder < moduleList.length - 1) {
    const nextModule = moduleList[moduleOrder + 1];
    return `/lessons/${nextModule.module_id}/${nextModule.chunk_ids[0]}`;
  }
  return null;
}

export default function LessonChunkPage() {
  const { user, loading: authLoading, refetchUser } = useAuth();
  const router = useRouter();
  const params = useParams<{ moduleId: string; chunkId: string }>();

  const moduleId = params.moduleId;
  const chunkId = params.chunkId;

  const authReady = !authLoading && !!user && user.role === "student";
  const { data: moduleDetail, error: moduleError, isLoading: moduleLoading } = useLessonModule(authReady ? moduleId : null);
  const { data: moduleList, error: modulesError, isLoading: modulesLoading } = useLessonModules(authReady);
  const { mutate: progressMutate } = useLessonProgress(authReady);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [attemptResult, setAttemptResult] = useState<QuizAttemptResponse | null>(null);
  const [stage, setStage] = useState<"learn" | "quick_check" | "quiz" | "scenario">("learn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lessonScenario, setLessonScenario] = useState<Scenario | null>(null);
  const [scenarioPhase, setScenarioPhase] = useState<"idle" | "loading" | "displayed" | "submitted">("idle");
  const [selectedMcIndex, setSelectedMcIndex] = useState<number | null>(null);
  const [scenarioMcCorrect, setScenarioMcCorrect] = useState<boolean | null>(null);

  const isLoading = authLoading || moduleLoading || modulesLoading;
  const fetchError = moduleError || modulesError;

  const chunk = useMemo(() => {
    if (!moduleDetail) return null;
    return moduleDetail.chunks.find((item) => item.chunk_id === chunkId) ?? null;
  }, [moduleDetail, chunkId]);

  useEffect(() => {
    if (stage !== "scenario" || lessonScenario !== null || !moduleDetail) return;
    const chunk = moduleDetail.chunks.find((c) => c.chunk_id === chunkId);
    if (!chunk) return;
    setScenarioPhase("loading");
    generateLessonScenario({
      chunk_title: chunk.title,
      learning_goal: chunk.learning_goal,
      key_takeaway: chunk.key_takeaway,
    })
      .then((s) => {
        setLessonScenario(s);
        setScenarioPhase("displayed");
      })
      .catch(() => setScenarioPhase("idle"));
  }, [stage, lessonScenario, moduleDetail, chunkId]);

  const handleScenarioMcSubmit = () => {
    if (selectedMcIndex === null || !lessonScenario?.multiple_choice) return;
    setScenarioMcCorrect(selectedMcIndex === lessonScenario.multiple_choice.correct_index);
    setScenarioPhase("submitted");
  };

  if (!authLoading && !user) {
    router.replace("/auth/login");
    return null;
  }
  if (!authLoading && user && user.role !== "student") {
    router.replace(user.role === "educator" ? "/dashboard" : "/");
    return null;
  }

  if (isLoading) {
    return <LessonChunkSkeleton />;
  }

  if (!chunk || !moduleDetail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-red-400">
          {fetchError instanceof Error ? fetchError.message : "Chunk not found."}
        </p>
      </div>
    );
  }
  const currentChunk = chunk;

  const canSubmit = currentChunk.quiz_items.every((item) => {
    if (item.item_type === "reflection") return true;
    const value = answers[item.item_id]?.trim();
    return Boolean(value);
  });

  const nextPath = nextChunkPath(moduleId, chunkId, moduleDetail, moduleList ?? []);

  async function handleSubmitAttempt() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        answers: currentChunk.quiz_items.map((item) =>
          item.item_type === "reflection"
            ? { item_id: item.item_id, response_text: answers[item.item_id] ?? "" }
            : { item_id: item.item_id, selected_option_id: answers[item.item_id] },
        ),
      };
      const result = await submitChunkAttempt(chunkId, payload);
      setAttemptResult(result);
      setSubmitting(false);
      await refetchUser();
      await progressMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompleteAndContinue() {
    setSubmitting(true);
    setError(null);
    try {
      await markChunkComplete(chunkId);
      await refetchUser();
      await progressMutate();
      if (nextPath) {
        router.push(nextPath);
      } else {
        router.push("/lessons");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete chunk");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/lessons" className="text-sm text-zinc-400 hover:text-white">
          ← Back to Lessons
        </Link>
        <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-zinc-300">
          {moduleDetail.title} · Chunk {currentChunk.order}/4
        </span>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 ${stage === "learn" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
          1. Learn
        </span>
        <span className={`rounded-full px-2.5 py-1 ${stage === "quick_check" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
          2. Quick Check
        </span>
        <span className={`rounded-full px-2.5 py-1 ${stage === "quiz" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
          3. Quiz
        </span>
        <span className={`rounded-full px-2.5 py-1 ${stage === "scenario" ? "bg-blue-500/20 text-blue-300" : "bg-zinc-800 text-zinc-400"}`}>
          4. Scenario
        </span>
      </div>

      {stage === "learn" && (
        <div className="card-glow mb-6 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-white">{currentChunk.title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{currentChunk.learning_goal}</p>

          <div className="mt-6 space-y-5">
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Concepts</p>
              <p className="mt-2 whitespace-pre-line text-zinc-300 leading-relaxed">{currentChunk.explain_text}</p>
            </section>

            <section className="relative">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">Example</p>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 pr-10 text-sm text-zinc-200 shadow-[0_0_20px_rgba(59,130,246,0.08)]">
                <p className="whitespace-pre-line leading-relaxed">{currentChunk.example_text}</p>
                <span className="absolute top-8 right-4 text-amber-400/90" aria-hidden="true">💡</span>
              </div>
            </section>

            <div className="rounded-xl border-2 border-blue-500/40 bg-blue-500/10 px-4 py-3">
              <p className="text-sm font-bold text-white">Key takeaway:</p>
              <p className="mt-1 text-sm text-blue-100">{currentChunk.key_takeaway}</p>
            </div>
          </div>

          <button
            onClick={() => setStage("quick_check")}
            className="btn-primary-glow mt-6 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.25)]"
          >
            Continue to Quick Check
          </button>
        </div>
      )}

      {stage === "quick_check" && (
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
          <h2 className="text-lg font-semibold text-white">Quick Check</h2>
          <p className="mt-2 text-sm text-zinc-300">Before the quiz, confirm the core idea in your own words:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {currentChunk.quick_check_prompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setStage("learn")}
              className="rounded-xl border border-white/[0.14] bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200"
            >
              Back to Lesson
            </button>
            <button
              onClick={() => setStage("quiz")}
              className="rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Start Micro-Quiz
            </button>
          </div>
        </div>
      )}

      {stage === "quiz" && (
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">Micro-Quiz</h2>
          <div className="space-y-5">
            {currentChunk.quiz_items.map((item) => (
              <div key={item.item_id} className="rounded-xl border border-white/[0.08] bg-zinc-900/60 p-4">
                <p className="mb-3 text-sm font-medium text-zinc-100">{item.prompt}</p>
                {item.item_type === "reflection" ? (
                  <textarea
                    value={answers[item.item_id] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [item.item_id]: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-white/[0.1] bg-zinc-800/60 px-3 py-2 text-sm text-white outline-none ring-blue-500/40 focus:ring-1"
                    placeholder="Write your 1-2 sentence reflection (optional)"
                  />
                ) : (
                  <div className="space-y-2">
                    {item.options.map((option) => {
                      const selected = answers[item.item_id] === option.id;
                      const correctOptionId = item.correct_option_id ?? null;
                      const itemFeedback = attemptResult?.item_feedback.find((f) => f.item_id === item.item_id);
                      const showResult = Boolean(attemptResult && itemFeedback);
                      const isCorrectOption = correctOptionId != null && option.id === correctOptionId;
                      const isSelectedWrong = showResult && selected && itemFeedback?.correct === false;
                      const optionStyle =
                        showResult && isCorrectOption
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                          : showResult && isSelectedWrong
                            ? "border-red-500/50 bg-red-500/15 text-red-100"
                            : "border-white/[0.08] bg-zinc-800/40 text-zinc-200";
                      return (
                        <label
                          key={option.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${optionStyle} ${showResult ? "cursor-default" : "cursor-pointer"}`}
                        >
                          <input
                            type="radio"
                            name={item.item_id}
                            value={option.id}
                            checked={selected}
                            onChange={(e) =>
                              setAnswers((prev) => ({ ...prev, [item.item_id]: e.target.value }))
                            }
                            disabled={showResult}
                            className={showResult ? "cursor-default" : ""}
                          />
                          <span>{option.text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmitAttempt}
            disabled={!canSubmit || submitting}
            className="mt-5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        </div>
      )}

      {attemptResult && (
        <div className="mb-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
          <h3 className="text-lg font-semibold text-white">Feedback</h3>
          <p className="mt-2 text-sm text-zinc-300">
            Score: <span className="font-semibold text-white">{attemptResult.score_percent.toFixed(1)}%</span> ·
            Best: <span className="font-semibold text-white"> {attemptResult.best_score.toFixed(1)}%</span> · XP gained:
            <span className="font-semibold text-blue-300"> {attemptResult.xp_earned}</span>
          </p>
          {attemptResult.recommended_retry && (
            <p className="mt-2 text-sm text-amber-300">
              Recommended: retry for mastery (80%+) before continuing.
            </p>
          )}

          <div className="mt-4 space-y-3">
            {attemptResult.item_feedback.map((item) => (
              <div key={item.item_id} className="rounded-lg border border-white/[0.08] bg-zinc-800/40 p-3">
                <p className="text-sm text-zinc-200">
                  {item.correct === null ? "Reflection" : item.correct ? "Correct" : "Not yet"}: {item.feedback}
                </p>
                <p className="mt-1 text-xs text-zinc-400">Why this matters: {item.why_it_matters}</p>
              </div>
            ))}
          </div>

          {stage === "quiz" && (
            <button
              onClick={() => setStage("scenario")}
              className="mt-5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue to Scenario
            </button>
          )}
        </div>
      )}

      {stage === "scenario" && scenarioPhase === "loading" && (
        <div className="mb-6">
          <ScenarioCardSkeleton />
        </div>
      )}

      {stage === "scenario" && (scenarioPhase === "displayed" || scenarioPhase === "submitted") && lessonScenario && (
        <div className="mb-6 space-y-6">
          <ScenarioCard scenario={lessonScenario} />
          {lessonScenario.multiple_choice ? (
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
              <p className="mb-4 text-lg font-semibold text-white">{lessonScenario.question}</p>
              <ul className="space-y-2">
                {lessonScenario.multiple_choice.options.map((option, i) => {
                  const correctIndex = lessonScenario!.multiple_choice!.correct_index;
                  const submitted = scenarioPhase === "submitted";
                  const isCorrectOption = submitted && i === correctIndex;
                  const isSelectedWrong = submitted && selectedMcIndex === i && selectedMcIndex !== correctIndex;
                  const optionStyle = submitted
                    ? isCorrectOption
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-100"
                      : isSelectedWrong
                        ? "border-red-500/50 bg-red-500/15 text-red-100"
                        : "border-white/[0.08] bg-zinc-800/40 text-zinc-200"
                    : "border-white/[0.08] bg-zinc-800/40 text-zinc-200 transition-colors hover:bg-zinc-800/60 has-[:checked]:border-blue-500/50 has-[:checked]:bg-blue-500/10 has-[:checked]:text-white";
                  return (
                    <li key={i}>
                      <label className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${optionStyle} ${submitted ? "cursor-default" : "cursor-pointer"}`}>
                        <input
                          type="radio"
                          name="scenario-mc"
                          checked={selectedMcIndex === i}
                          onChange={() => !submitted && setSelectedMcIndex(i)}
                          disabled={submitted}
                          className="border-white/20 bg-zinc-800 text-blue-500 focus:ring-blue-500/50 disabled:cursor-default"
                        />
                        <span>{option}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {scenarioPhase === "displayed" && (
                <button
                  type="button"
                  onClick={handleScenarioMcSubmit}
                  disabled={selectedMcIndex === null}
                  className="mt-4 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Submit answer
                </button>
              )}
              {scenarioPhase === "submitted" && (
                <>
                  {scenarioMcCorrect === true ? (
                    <p className="mt-4 text-lg font-semibold text-emerald-400">Correct!</p>
                  ) : (
                    <p className="mt-4 text-lg font-semibold text-amber-400">Not quite. Review the lesson and try again next time.</p>
                  )}
                  <button
                    onClick={handleCompleteAndContinue}
                    disabled={submitting}
                    className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300"
                  >
                    Mark Complete & Continue
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
              <button
                type="button"
                onClick={handleCompleteAndContinue}
                disabled={submitting}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300"
              >
                Mark Complete & Continue
              </button>
            </div>
          )}
        </div>
      )}

      <div className="card-glow rounded-2xl border border-rose-500/25 bg-zinc-900/30 p-6 shadow-[0_0_24px_rgba(244,63,94,0.06)]">
        <h3 className="text-sm font-bold uppercase tracking-wide text-rose-300/90">Common Mistakes</h3>
        <ul className="mt-3 space-y-2 text-sm text-zinc-300">
          {currentChunk.common_mistakes.map((mistake) => (
            <li key={mistake} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 text-rose-400" aria-hidden="true">✕</span>
              <span>{mistake}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

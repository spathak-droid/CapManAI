"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ScenarioCard from "@/components/ScenarioCard";
import { useAuth } from "@/contexts/AuthContext";
import {
  generateLessonScenario,
  markChunkComplete,
  submitChunkAttempt,
} from "@/lib/api";
import { useLessonModule, useLessonModules, useLessonProgress, useLessonChunk } from "@/lib/hooks";
import { LessonChunkSkeleton } from "@/components/skeletons/LessonChunkSkeleton";
import { ScenarioCardSkeleton } from "@/components/skeletons/ScenarioCardSkeleton";
import { gsap, useStaggerReveal, useScrollReveal } from "@/lib/gsap";
import type {
  LessonModuleDetail,
  LessonModuleSummary,
  QuizAttemptResponse,
  Scenario,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

type Stage = "learn" | "quick_check" | "quiz" | "scenario";

const STAGES: { key: Stage; label: string; num: number }[] = [
  { key: "learn", label: "Learn", num: 1 },
  { key: "quick_check", label: "Quick Check", num: 2 },
  { key: "quiz", label: "Quiz", num: 3 },
  { key: "scenario", label: "Scenario", num: 4 },
];

function stageIndex(s: Stage): number {
  return STAGES.findIndex((st) => st.key === s);
}

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

/* ------------------------------------------------------------------ */
/*  Step Indicator                                                    */
/* ------------------------------------------------------------------ */

function StepIndicator({ current }: { current: Stage }) {
  const ci = stageIndex(current);

  return (
    <div className="flex items-center justify-between w-full max-w-xl mx-auto mb-8">
      {STAGES.map((step, i) => {
        const completed = i < ci;
        const active = i === ci;
        const future = i > ci;
        return (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div className="relative">
                {active && (
                  <span className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                )}
                <div
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                    completed
                      ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                      : active
                        ? "bg-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.5)]"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                  }`}
                >
                  {completed ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.num
                  )}
                </div>
              </div>
              <span
                className={`mt-2 text-[11px] font-medium tracking-wide ${
                  completed
                    ? "text-emerald-400"
                    : active
                      ? "text-blue-400"
                      : "text-zinc-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {i < STAGES.length - 1 && (
              <div className="flex-1 mx-2 mt-[-20px]">
                <div
                  className={`h-0.5 w-full rounded-full transition-all duration-500 ${
                    i < ci
                      ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]"
                      : "bg-zinc-800"
                  }`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated score counter                                            */
/* ------------------------------------------------------------------ */

function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: 0 };
    const tween = gsap.to(obj, {
      v: value,
      duration: 1.2,
      delay: 0.2,
      ease: "power2.out",
      onUpdate() {
        el.textContent = obj.v.toFixed(1) + "%";
      },
    });
    return () => { tween.kill(); };
  }, [value]);

  return <span ref={ref} className={className}>0%</span>;
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                               */
/* ------------------------------------------------------------------ */

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
  const [stage, setStage] = useState<Stage>("learn");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deepDiveOpen, setDeepDiveOpen] = useState(false);
  const deepDiveContentRef = useRef<HTMLDivElement>(null);

  const [lessonScenario, setLessonScenario] = useState<Scenario | null>(null);
  const [scenarioPhase, setScenarioPhase] = useState<"idle" | "loading" | "displayed" | "submitted">("idle");
  const [selectedMcIndex, setSelectedMcIndex] = useState<number | null>(null);
  const [scenarioMcCorrect, setScenarioMcCorrect] = useState<boolean | null>(null);

  const isLoading = authLoading || moduleLoading || modulesLoading;
  const fetchError = moduleError || modulesError;

  // Fetch individual chunk (has RAG supplementary_context) alongside module data
  const { data: ragChunk } = useLessonChunk(authReady ? chunkId : null);

  const chunk = useMemo(() => {
    if (!moduleDetail) return null;
    const base = moduleDetail.chunks.find((item) => item.chunk_id === chunkId) ?? null;
    if (base && ragChunk?.supplementary_context) {
      return { ...base, supplementary_context: ragChunk.supplementary_context };
    }
    return base;
  }, [moduleDetail, chunkId, ragChunk]);

  // --- Stage transition GSAP ---
  const stageContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stageContentRef.current;
    if (!el) return;
    gsap.fromTo(el, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
  }, [stage, attemptResult]);

  // Stagger refs
  const quizItemsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.1, y: 20 });
  const feedbackItemsRef = useStaggerReveal<HTMLDivElement>({ stagger: 0.08, y: 16 });
  const mistakesRef = useScrollReveal<HTMLDivElement>({ y: 24 });

  // --- Scenario generation ---
  useEffect(() => {
    if (stage !== "scenario" || lessonScenario !== null || !moduleDetail) return;
    const c = moduleDetail.chunks.find((ch) => ch.chunk_id === chunkId);
    if (!c) return;
    setScenarioPhase("loading");
    generateLessonScenario({
      chunk_title: c.title,
      learning_goal: c.learning_goal,
      key_takeaway: c.key_takeaway,
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

  if (authLoading || isLoading) {
    return <LessonChunkSkeleton />;
  }

  if (!user) {
    router.replace("/auth/login");
    return <LessonChunkSkeleton />;
  }
  if (user.role !== "student") {
    router.replace(user.role === "educator" ? "/dashboard" : "/");
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
      // Navigate immediately — refresh caches in the background
      router.push(nextPath ?? "/lessons");
      refetchUser();
      progressMutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete chunk");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* ── Top Bar ── */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/lessons"
          className="group flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Lessons
        </Link>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-zinc-900/80 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm">
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent font-semibold">
            {moduleDetail.title}
          </span>
          <span className="h-1 w-1 rounded-full bg-zinc-600" />
          <span className="tabular-nums">Chunk {currentChunk.order}/4</span>
        </span>
      </div>

      {/* ── Step Progress Indicator ── */}
      <StepIndicator current={stage} />

      {/* ── Stage Content ── */}
      <div ref={stageContentRef}>
        {/* ===================== LEARN STAGE ===================== */}
        {stage === "learn" && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8">
            {/* Background decoration */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/[0.06] blur-3xl" aria-hidden />
            <div className="absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-violet-500/[0.05] blur-3xl" aria-hidden />

            <div className="relative">
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  {currentChunk.title}
                </span>
              </h1>
              <p className="mt-2 text-sm text-zinc-400 max-w-2xl">{currentChunk.learning_goal}</p>

              <div className="mt-8 space-y-6">
                {/* Concepts */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Concepts</p>
                  </div>
                  <p className="whitespace-pre-line text-zinc-300 leading-relaxed text-[15px]">
                    {currentChunk.explain_text}
                  </p>
                </section>

                {/* Example */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Example</p>
                  </div>
                  <div className="relative rounded-xl border-l-4 border-blue-500/60 bg-blue-500/[0.06] p-5 shadow-[0_0_24px_rgba(59,130,246,0.08)]">
                    <p className="whitespace-pre-line text-sm text-zinc-200 leading-relaxed">
                      {currentChunk.example_text}
                    </p>
                  </div>
                </section>

                {/* Key Takeaway */}
                <div className="rounded-xl p-5 text-white"
                  style={{
                    background: "linear-gradient(135deg, rgba(59,130,246,0.85) 0%, rgba(139,92,246,0.85) 50%, rgba(168,85,247,0.85) 100%)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="h-5 w-5 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <p className="text-sm font-bold uppercase tracking-wide text-white/90">Key Takeaway</p>
                  </div>
                  <p className="text-[15px] leading-relaxed text-white/95">{currentChunk.key_takeaway}</p>
                </div>

                {/* Deep Dive — RAG supplementary context */}
                {currentChunk.supplementary_context && currentChunk.supplementary_context.trim() !== "" && (
                  <section className="rounded-xl border border-white/[0.06] bg-zinc-900/50">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !deepDiveOpen;
                        setDeepDiveOpen(next);
                        // Animate open/close with GSAP
                        const el = deepDiveContentRef.current;
                        if (el) {
                          if (next) {
                            el.style.display = "block";
                            gsap.fromTo(el, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.4, ease: "power3.out" });
                          } else {
                            gsap.to(el, {
                              height: 0,
                              opacity: 0,
                              duration: 0.3,
                              ease: "power3.in",
                              onComplete: () => { el.style.display = "none"; },
                            });
                          }
                        }
                      }}
                      className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] rounded-xl"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-200">Deep Dive</p>
                          <p className="text-xs text-zinc-500">Want to learn more? Expand for additional context</p>
                        </div>
                      </div>
                      <svg
                        className={`h-4 w-4 text-zinc-400 transition-transform duration-300 ${deepDiveOpen ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    <div
                      ref={deepDiveContentRef}
                      className="overflow-hidden"
                      style={{ display: "none", height: 0 }}
                    >
                      <div className="px-5 pb-5 space-y-3">
                        {currentChunk.supplementary_context
                          .split("---")
                          .map((block) => block.trim())
                          .filter(Boolean)
                          .map((block, i) => (
                            <div
                              key={i}
                              className="rounded-lg border-l-[3px] border-violet-500/50 bg-zinc-800/60 px-4 py-3"
                            >
                              <p className="whitespace-pre-line text-sm text-zinc-300 leading-relaxed">
                                {block}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </section>
                )}
              </div>

              <button
                onClick={() => setStage("quick_check")}
                className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition-all hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue to Quick Check
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ===================== QUICK CHECK STAGE ===================== */}
        {stage === "quick_check" && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/[0.05] blur-3xl" aria-hidden />

            <div className="relative">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Quick Check</h2>
              </div>
              <p className="text-sm text-zinc-400 mb-6">
                Before the quiz, confirm the core idea in your own words:
              </p>

              <div className="space-y-3">
                {currentChunk.quick_check_prompts.map((prompt, i) => (
                  <div
                    key={prompt}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-zinc-800/40 p-4"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-bold text-blue-400 tabular-nums">
                      {i + 1}
                    </span>
                    <span className="text-sm text-zinc-200 leading-relaxed">{prompt}</span>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  onClick={() => setStage("learn")}
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.08] hover:border-white/[0.16]"
                >
                  Back
                </button>
                <button
                  onClick={() => setStage("quiz")}
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition-all hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Start Micro-Quiz
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== QUIZ STAGE ===================== */}
        {stage === "quiz" && (
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8">
            <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-blue-500/[0.05] blur-3xl" aria-hidden />

            <div className="relative">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                  <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-white">Micro-Quiz</h2>
              </div>

              <div ref={quizItemsRef} className="space-y-5">
                {currentChunk.quiz_items.map((item, idx) => (
                  <div
                    key={item.item_id}
                    className="rounded-xl border-l-4 border-blue-500/40 bg-zinc-900/60 border border-l-4 border-white/[0.06] p-5"
                    style={{ borderLeftColor: "rgba(59,130,246,0.4)" }}
                  >
                    <p className="mb-4 text-[15px] font-semibold text-zinc-100">
                      <span className="mr-2 text-blue-400/80 tabular-nums">{idx + 1}.</span>
                      {item.prompt}
                    </p>

                    {item.item_type === "reflection" ? (
                      <textarea
                        value={answers[item.item_id] ?? ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [item.item_id]: e.target.value }))
                        }
                        rows={3}
                        className="w-full rounded-xl border border-white/[0.1] bg-zinc-800/60 px-4 py-3 text-sm text-white outline-none transition-all focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20 placeholder:text-zinc-600"
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

                          let optionStyle: string;
                          if (showResult && isCorrectOption) {
                            optionStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.1)]";
                          } else if (showResult && isSelectedWrong) {
                            optionStyle = "border-red-500/50 bg-red-500/10 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.1)]";
                          } else if (selected && !showResult) {
                            optionStyle = "border-blue-500/50 bg-blue-500/10 text-white";
                          } else {
                            optionStyle = "border-white/[0.08] bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 hover:border-white/[0.12]";
                          }

                          return (
                            <label
                              key={option.id}
                              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${optionStyle} ${showResult ? "cursor-default" : "cursor-pointer"}`}
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
                                className="sr-only"
                              />
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                  showResult && isCorrectOption
                                    ? "border-emerald-400 bg-emerald-500"
                                    : showResult && isSelectedWrong
                                      ? "border-red-400 bg-red-500"
                                      : selected
                                        ? "border-blue-400 bg-blue-500"
                                        : "border-zinc-600 bg-transparent"
                                }`}
                              >
                                {(selected || (showResult && isCorrectOption)) && (
                                  <span className="h-2 w-2 rounded-full bg-white" />
                                )}
                              </span>
                              <span>{option.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {!attemptResult && (
                <div className="mt-6">
                  <button
                    onClick={handleSubmitAttempt}
                    disabled={!canSubmit || submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition-all hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {submitting ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Quiz"
                    )}
                  </button>
                  {!canSubmit && !submitting && (() => {
                    const unanswered = currentChunk.quiz_items.filter(
                      (item) => item.item_type !== "reflection" && !answers[item.item_id]?.trim()
                    ).length;
                    return unanswered > 0 ? (
                      <p className="mt-2 text-xs text-zinc-500">
                        Answer {unanswered === 1 ? "1 remaining question" : `all ${unanswered} remaining questions`} to submit.
                      </p>
                    ) : null;
                  })()}
                  {error && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-4 text-sm text-red-400">
                      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== FEEDBACK (attemptResult) ===================== */}
        {attemptResult && (
          <div className="mt-6 relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8">
            <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-violet-500/[0.05] blur-3xl" aria-hidden />

            <div className="relative">
              <h3 className="text-lg font-semibold text-white mb-6">Results</h3>

              {/* Score display */}
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-baseline gap-1">
                  <AnimatedScore
                    value={attemptResult.score_percent}
                    className={`text-4xl font-bold tabular-nums ${
                      attemptResult.score_percent >= 80
                        ? "text-emerald-400"
                        : attemptResult.score_percent >= 60
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.1] bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-300">
                    Best: {attemptResult.best_score.toFixed(1)}%
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/[0.08] px-3 py-1.5 text-xs font-medium text-blue-300">
                    +{attemptResult.xp_earned} XP
                  </span>
                </div>
              </div>

              {/* Retry banner */}
              {attemptResult.recommended_retry && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-sm text-amber-200">
                    Recommended: retry for mastery (80%+) before continuing.
                  </p>
                </div>
              )}

              {/* Item feedback */}
              <div ref={feedbackItemsRef} className="space-y-3">
                {attemptResult.item_feedback.map((item) => {
                  const borderColor =
                    item.correct === null
                      ? "border-l-zinc-500/60"
                      : item.correct
                        ? "border-l-emerald-500/60"
                        : "border-l-red-500/60";
                  const iconBg =
                    item.correct === null
                      ? "bg-zinc-500/15 text-zinc-400"
                      : item.correct
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400";

                  return (
                    <div
                      key={item.item_id}
                      className={`rounded-xl border border-white/[0.06] bg-zinc-900/60 p-4 border-l-4 ${borderColor}`}
                      style={{
                        borderLeftWidth: "4px",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${iconBg} mt-0.5`}>
                          {item.correct === null ? (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          ) : item.correct ? (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-zinc-200 leading-relaxed">
                            <span className="font-medium">
                              {item.correct === null ? "Reflection" : item.correct ? "Correct" : "Not yet"}:
                            </span>{" "}
                            {item.feedback}
                          </p>
                          <p className="mt-1.5 text-xs text-zinc-500">
                            Why this matters: {item.why_it_matters}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {stage === "quiz" && (
                <button
                  onClick={() => setStage("scenario")}
                  className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition-all hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Continue to Scenario
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===================== SCENARIO STAGE ===================== */}
        {stage === "scenario" && scenarioPhase === "loading" && (
          <div className="mt-6">
            <ScenarioCardSkeleton />
          </div>
        )}

        {stage === "scenario" && (scenarioPhase === "displayed" || scenarioPhase === "submitted") && lessonScenario && (
          <div className="mt-6 space-y-6">
            <ScenarioCard scenario={lessonScenario} />

            {lessonScenario.multiple_choice ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-zinc-900/80 via-zinc-900/60 to-zinc-900/80 p-8">
                <div className="absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-blue-500/[0.04] blur-3xl" aria-hidden />

                <div className="relative">
                  <p className="mb-5 text-lg font-semibold text-white">{lessonScenario.question}</p>
                  <ul className="space-y-2.5">
                    {lessonScenario.multiple_choice.options.map((option, i) => {
                      const correctIndex = lessonScenario!.multiple_choice!.correct_index;
                      const submitted = scenarioPhase === "submitted";
                      const isCorrectOption = submitted && i === correctIndex;
                      const isSelectedWrong = submitted && selectedMcIndex === i && selectedMcIndex !== correctIndex;
                      const isSelected = selectedMcIndex === i;

                      let optionStyle: string;
                      if (submitted && isCorrectOption) {
                        optionStyle = "border-emerald-500/50 bg-emerald-500/10 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.1)]";
                      } else if (submitted && isSelectedWrong) {
                        optionStyle = "border-red-500/50 bg-red-500/10 text-red-100 shadow-[0_0_12px_rgba(239,68,68,0.1)]";
                      } else if (isSelected && !submitted) {
                        optionStyle = "border-blue-500/50 bg-blue-500/10 text-white";
                      } else {
                        optionStyle = "border-white/[0.08] bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800/60 hover:border-white/[0.12]";
                      }

                      return (
                        <li key={i}>
                          <label
                            className={`flex items-center gap-3 rounded-xl border px-5 py-3.5 text-sm transition-all ${optionStyle} ${submitted ? "cursor-default" : "cursor-pointer"}`}
                          >
                            <input
                              type="radio"
                              name="scenario-mc"
                              checked={selectedMcIndex === i}
                              onChange={() => !submitted && setSelectedMcIndex(i)}
                              disabled={submitted}
                              className="sr-only"
                            />
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                submitted && isCorrectOption
                                  ? "border-emerald-400 bg-emerald-500"
                                  : submitted && isSelectedWrong
                                    ? "border-red-400 bg-red-500"
                                    : isSelected
                                      ? "border-blue-400 bg-blue-500"
                                      : "border-zinc-600 bg-transparent"
                              }`}
                            >
                              {(isSelected || (submitted && isCorrectOption)) && (
                                <span className="h-2 w-2 rounded-full bg-white" />
                              )}
                            </span>
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
                      className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/25 transition-all hover:shadow-violet-900/40 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                      Submit Answer
                    </button>
                  )}

                  {scenarioPhase === "submitted" && (
                    <div className="mt-5">
                      {scenarioMcCorrect === true ? (
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                            <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <p className="text-lg font-semibold text-emerald-400">Correct!</p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20">
                            <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                            </svg>
                          </div>
                          <p className="text-lg font-semibold text-amber-400">
                            Not quite. Review the lesson and try again next time.
                          </p>
                        </div>
                      )}

                      <button
                        onClick={handleCompleteAndContinue}
                        disabled={submitting}
                        className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition-all hover:shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      >
                        {submitting ? (
                          <>
                            <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Completing...
                          </>
                        ) : (
                          <>
                            Mark Complete & Continue
                            <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-zinc-900/60 p-8">
                <button
                  type="button"
                  onClick={handleCompleteAndContinue}
                  disabled={submitting}
                  className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/25 transition-all hover:shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Completing...
                    </>
                  ) : (
                    <>
                      Mark Complete & Continue
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================== COMMON MISTAKES ===================== */}
      <div
        ref={mistakesRef}
        className="mt-8 relative overflow-hidden rounded-2xl border border-rose-500/20 bg-zinc-900/60 p-6 shadow-[0_0_30px_rgba(244,63,94,0.06)]"
      >
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-rose-500/[0.06] blur-3xl" aria-hidden />

        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-rose-300/90">Common Mistakes</h3>
          </div>

          <div className="space-y-2">
            {currentChunk.common_mistakes.map((mistake) => (
              <div
                key={mistake}
                className="flex items-start gap-3 rounded-xl border border-rose-500/10 bg-rose-500/[0.04] p-3.5"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/15 mt-0.5">
                  <svg className="h-3 w-3 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="text-sm text-zinc-300 leading-relaxed">{mistake}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Error is now displayed next to the Submit button */}
    </div>
  );
}

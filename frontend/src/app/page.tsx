"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import StudentHome from "@/components/StudentHome";
import EducatorHome from "@/components/EducatorHome";

function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background grid */}
      <div className="bg-grid absolute inset-0" />

      {/* Radial glow behind hero */}
      <div className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 -translate-y-1/2">
        <div className="h-[480px] w-[480px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="sr-only">CapMan AI</h1>
        <img src="/logo.svg" alt="" className="mb-6 h-28 w-auto sm:h-36 lg:h-40" aria-hidden="true" />

        <p className="mb-4 text-xl font-medium tracking-tight text-zinc-300 sm:text-2xl">
          Master Trading Through AI-Powered Scenarios
        </p>

        <p className="mb-10 max-w-2xl text-base leading-relaxed text-zinc-500 sm:text-lg">
          Practice capital management with realistic, AI-generated trading
          scenarios. Receive instant grading with detailed feedback, track your
          skill growth, and compete on the leaderboard. Built for students and
          guided by educators using the MTSS framework.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/auth/login"
            className="btn-purple-solid inline-flex items-center justify-center rounded-full px-8 py-3 text-base shadow-lg shadow-violet-500/25 transition-all hover:scale-[1.02]"
          >
            Get Started
          </Link>
          <Link
            href="/auth/register"
            className="btn-primary-glow inline-flex items-center justify-center rounded-full px-8 py-3 text-base font-semibold"
          >
            Create Account
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1 — AI-Generated Scenarios */}
          <div className="card-glow group p-6 transition-shadow hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">
              AI-Generated Scenarios
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Every scenario is unique. Our AI crafts realistic market situations
              with real data to challenge your analytical skills at every level.
            </p>
          </div>

          {/* Card 2 — Instant Grading & Feedback */}
          <div className="card-glow group p-6 transition-shadow hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
              <svg
                className="h-5 w-5 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">
              Instant Grading &amp; Feedback
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Get scored across multiple dimensions with actionable feedback.
              Probing follow-up questions push your thinking deeper.
            </p>
          </div>

          {/* Card 3 — MTSS-Powered Tiers */}
          <div className="card-glow group p-6 transition-shadow hover:shadow-[0_0_28px_rgba(59,130,246,0.12)]">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <svg
                className="h-5 w-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.504-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.04 6.04 0 01-2.27.79 6.04 6.04 0 01-2.27-.79"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-base font-semibold text-white">
              MTSS-Powered Tiers
            </h3>
            <p className="text-sm leading-relaxed text-zinc-400">
              Educators can monitor student progress through the MTSS framework
              with tiered interventions and skill-level heatmaps.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();

  // Still loading auth state — show nothing (avoids flash)
  if (loading) return null;

  // Not logged in — show marketing landing page
  if (!user) return <LandingPage />;

  // Logged in as educator
  if (user.role === "educator") return <EducatorHome />;

  // Logged in as student (or any other role)
  return <StudentHome />;
}

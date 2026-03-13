"use client";

import Link from "next/link";

export default function CapstonePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
        Capstone Trading Mission
      </h1>
      <p className="mt-3 text-zinc-400">
        This mission combines all skills into a guided multi-step challenge with checkpoint quizzes.
      </p>

      <div className="mt-6 rounded-2xl border border-white/[0.08] bg-zinc-900/30 p-6">
        <p className="text-zinc-200">
          You will move through four mission chunks: context scan, plan design, risk controls, and live management.
        </p>
        <Link
          href="/lessons/c1/c1-ch1"
          className="mt-5 inline-flex rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Start Capstone
        </Link>
      </div>
    </div>
  );
}

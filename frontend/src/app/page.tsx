import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
        <h1 className="mb-6 text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl dark:text-white">
          CapMan AI
        </h1>
        <p className="mb-4 max-w-2xl text-xl font-medium text-blue-600 sm:text-2xl dark:text-blue-400">
          Master Trading Through AI-Powered Scenarios
        </p>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Practice capital management with realistic, AI-generated trading
          scenarios. Receive instant grading with detailed feedback, track your
          skill growth, and compete on the leaderboard. Built for students and
          guided by educators using the MTSS framework.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/scenario"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Start Training
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-xl border-2 border-gray-300 bg-white px-8 py-3.5 text-lg font-semibold text-gray-700 transition-all hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
          >
            Educator Dashboard
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="pb-20">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-700">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <svg
                className="h-6 w-6 text-blue-600 dark:text-blue-400"
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
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              AI-Generated Scenarios
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Every scenario is unique. Our AI crafts realistic market situations
              with real data to challenge your analytical skills at every level.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-700">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
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
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              Instant Grading & Feedback
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Get scored across multiple dimensions with actionable feedback.
              Probing follow-up questions push your thinking deeper.
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-700">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900">
              <svg
                className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-4.5A3.375 3.375 0 0019.875 10.875 3.375 3.375 0 0016.5 7.5h0a3.375 3.375 0 00-3.375 3.375v4.5m-3.75 3.375v-4.5A3.375 3.375 0 006 10.875 3.375 3.375 0 002.625 7.5h0A3.375 3.375 0 006 10.875v4.5"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
              MTSS-Powered Tiers
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Educators can monitor student progress through the MTSS framework
              with tiered interventions and skill-level heatmaps.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AboutPage() {
  const steps = [
    {
      number: 1,
      title: "Generate a scenario",
      description:
        "AI creates a unique market situation tailored to your skill level with real-world data.",
    },
    {
      number: 2,
      title: "Respond with your analysis",
      description:
        "Provide your trading decision and reasoning. Explain your strategy clearly.",
    },
    {
      number: 3,
      title: "Get graded instantly",
      description:
        "AI evaluates your response across multiple dimensions with actionable feedback.",
    },
    {
      number: 4,
      title: "Level up",
      description:
        "Earn XP, climb the leaderboard, and unlock progressively harder scenarios.",
    },
  ];

  const techStack = [
    "Next.js",
    "React",
    "FastAPI",
    "Python",
    "PostgreSQL",
    "OpenRouter",
    "Tailwind CSS",
    "TypeScript",
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      {/* Page Title */}
      <h1 className="gradient-text mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
        About CapMan AI
      </h1>

      <div className="space-y-6 text-base leading-relaxed text-zinc-400 sm:text-lg">
        <p>
          CapMan AI is a gamified trading scenario training platform powered by
          artificial intelligence. Students practice capital management through
          realistic, AI-generated market scenarios, receive instant grading with
          detailed feedback, and track their skill growth over time.
        </p>

        <p>
          Educators monitor student progress through the{" "}
          <span className="font-semibold text-white">
            Multi-Tiered System of Supports (MTSS)
          </span>{" "}
          framework, enabling tiered interventions and skill-level heatmaps to
          identify students who need additional support.
        </p>
      </div>

      {/* How It Works */}
      <section className="mt-16">
        <h2 className="mb-10 text-2xl font-bold text-white">How It Works</h2>

        <div className="relative ml-1">
          {/* Vertical connector line */}
          <div className="absolute left-5 top-10 bottom-10 w-px bg-gradient-to-b from-blue-500/40 via-violet-500/40 to-transparent" />

          <div className="space-y-10">
            {steps.map((step) => (
              <div key={step.number} className="relative flex gap-5">
                {/* Numbered circle */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-zinc-900 text-sm font-bold text-blue-400">
                  {step.number}
                </div>

                {/* Content */}
                <div className="pt-1.5">
                  <h3 className="text-base font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built With */}
      <section className="mt-16">
        <h2 className="mb-6 text-2xl font-bold text-white">Built With</h2>

        <div className="flex flex-wrap gap-2">
          {techStack.map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-white/[0.06] bg-zinc-800 px-3 py-1 text-sm text-zinc-300"
            >
              {tech}
            </span>
          ))}
        </div>

        <p className="mt-6 text-sm text-zinc-500">
          Designed for the EdTeam AI Gauntlet.
        </p>
      </section>
    </div>
  );
}

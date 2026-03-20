"use client";

import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[480px] w-[480px] rounded-full bg-blue-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="card-glow p-8 backdrop-blur-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold text-white">
              Sign Up Coming Soon
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400">
              We&apos;re working hard to make this available for everyone.
              In the meantime, please contact your institution to receive
              your sign-in credentials.
            </p>
          </div>

          <Link
            href="/auth/login"
            className="btn-purple-solid block w-full rounded-xl py-3 text-center"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

interface SkeletonProps {
  className?: string;
}

/** Base skeleton block; use with Tailwind for size. Matches app dark theme. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`rounded-md bg-zinc-700/50 animate-pulse ${className}`}
      aria-hidden
    />
  );
}

"use client";

import { useState } from "react";
import { useActivityFeed } from "@/lib/hooks";
import type { ActivityFeedItem } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";

const INITIAL_LIMIT = 10;

function EventIcon({ eventType }: { eventType: string }) {
  switch (eventType) {
    case "scenario_response":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 shadow-[0_0_10px_rgba(59,130,246,0.15)]">
          <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
      );
    case "level_up":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 shadow-[0_0_10px_rgba(16,185,129,0.15)]">
          <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
          </svg>
        </div>
      );
    case "new_user":
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 shadow-[0_0_10px_rgba(139,92,246,0.15)]">
          <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        </div>
      );
    default:
      return (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-500/10 shadow-[0_0_10px_rgba(113,113,122,0.1)]">
          <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </div>
      );
  }
}

function FeedItem({ item }: { item: ActivityFeedItem }) {
  return (
    <div className="group relative flex gap-3 pb-6 last:pb-0 rounded-lg px-2 py-1.5 -mx-2 transition-colors hover:bg-white/[0.02]">
      {/* Timeline connector line — gradient fade */}
      <div className="absolute left-[calc(0.5rem+16px)] top-10 bottom-0 w-px bg-gradient-to-b from-zinc-700 to-transparent" />
      <EventIcon eventType={item.event_type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-zinc-300 leading-relaxed">
          <span className="font-semibold text-white">{item.username}</span>{" "}
          {item.description}
        </p>
        <p className="text-xs text-zinc-500 mt-1 font-medium">
          {formatRelativeTime(item.timestamp)}
        </p>
      </div>
    </div>
  );
}

export default function ActivityFeed() {
  const { data: items, isLoading } = useActivityFeed();
  const [showAll, setShowAll] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-zinc-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-zinc-700 rounded" />
              <div className="h-3 w-16 bg-zinc-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 text-center py-4">No recent activity</p>
    );
  }

  const displayed = showAll ? items : items.slice(0, INITIAL_LIMIT);
  const hasMore = items.length > INITIAL_LIMIT;

  return (
    <div>
      <div className="relative">
        {displayed.map((item, idx) => (
          <FeedItem key={`${item.user_id}-${item.timestamp}-${idx}`} item={item} />
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-4 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors hover:underline underline-offset-4"
        >
          Show more ({items.length - INITIAL_LIMIT} more)
        </button>
      )}
    </div>
  );
}

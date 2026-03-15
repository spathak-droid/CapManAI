"use client";

import { useSWRConfig } from "swr";
import type { AnnouncementOut } from "@/lib/types";
import { deleteAnnouncement } from "@/lib/api";
import { useState } from "react";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const PRIORITY_STYLES: Record<string, { border: string; badge: string; label: string }> = {
  urgent: {
    border: "border-l-red-500",
    badge: "bg-red-500/10 text-red-400 border border-red-500/20",
    label: "Urgent",
  },
  important: {
    border: "border-l-amber-500",
    badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    label: "Important",
  },
  normal: {
    border: "border-l-blue-500",
    badge: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    label: "Normal",
  },
};

interface AnnouncementFeedProps {
  announcements: AnnouncementOut[];
  canDelete?: boolean;
  limit?: number;
}

export default function AnnouncementFeed({ announcements, canDelete = false, limit }: AnnouncementFeedProps) {
  const { mutate } = useSWRConfig();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const displayed = limit ? announcements.slice(0, limit) : announcements;

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await deleteAnnouncement(id);
      await mutate("announcements");
    } catch {
      // silently fail — user can retry
    } finally {
      setDeletingId(null);
    }
  }

  if (displayed.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/30 p-8 text-center">
        <svg className="h-8 w-8 mx-auto text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
        </svg>
        <p className="text-sm text-zinc-500">No announcements yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayed.map((a, i) => {
        const style = PRIORITY_STYLES[a.priority] ?? PRIORITY_STYLES.normal;
        return (
          <div
            key={a.id}
            className={`animate-slide-up rounded-xl border border-zinc-700/50 bg-zinc-800/30 border-l-4 ${style.border} p-4`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${style.badge}`}>
                    {style.label}
                  </span>
                  <h4 className="text-sm font-semibold text-white truncate">{a.title}</h4>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{a.content}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                  <span>{a.educator_name}</span>
                  <span>&middot;</span>
                  <span>{timeAgo(a.created_at)}</span>
                </div>
              </div>

              {canDelete && (
                <button
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Delete announcement"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useStudentRoster } from "@/lib/hooks";

const TIER_BADGE: Record<string, string> = {
  tier_1: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  tier_2: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  tier_3: "bg-red-500/10 text-red-400 border border-red-500/20",
};

function tierBadgeClass(tier: string): string {
  return TIER_BADGE[tier] ?? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
}

function tierLabel(tier: string): string {
  switch (tier) {
    case "tier_1":
      return "Tier 1";
    case "tier_2":
      return "Tier 2";
    case "tier_3":
      return "Tier 3";
    default:
      return tier;
  }
}

export default function StudentRosterPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: students, error, isLoading } = useStudentRoster();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.username.toLowerCase().includes(q) ||
        (s.name && s.name.toLowerCase().includes(q)),
    );
  }, [students, search]);

  if (!authLoading && user?.role !== "educator") {
    router.replace("/");
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
          Student Roster
        </h1>
        <p className="text-zinc-500 text-base">
          View all students, their progress, and leave feedback on responses.
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or username..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-xl border border-white/[0.08] bg-zinc-900/60 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20"
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-zinc-500">Loading students...</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 text-sm">
          {error instanceof Error ? error.message : "Failed to load students"}
        </div>
      )}

      {/* Table */}
      {students && (
        <>
          <div className="mb-3 text-sm text-zinc-500">
            {filtered.length} student{filtered.length !== 1 ? "s" : ""}
            {search && ` matching "${search}"`}
          </div>

          {filtered.length === 0 ? (
            <div className="card-glow p-10 text-center text-zinc-500">
              {search ? "No students match your search." : "No students found."}
            </div>
          ) : (
            <div className="card-glow overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Student
                    </th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Level
                    </th>
                    <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Tier
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Avg Score
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      XP
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Responses
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((student) => (
                    <tr
                      key={student.id}
                      className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.03]"
                      onClick={() =>
                        router.push(`/dashboard/students/${student.id}`)
                      }
                    >
                      <td className="px-5 py-3.5">
                        <div>
                          <span className="font-medium text-zinc-200">
                            {student.name || student.username}
                          </span>
                          {student.name && (
                            <span className="ml-2 text-xs text-zinc-500">
                              @{student.username}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
                          Lv. {student.level}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${tierBadgeClass(student.overall_tier)}`}
                        >
                          {tierLabel(student.overall_tier)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-zinc-200">
                        {student.avg_skill_score.toFixed(1)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-zinc-200">
                        {student.xp_total.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-zinc-200">
                        {student.response_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

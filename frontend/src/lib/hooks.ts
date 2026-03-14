"use client";

import useSWR from "swr";
import {
  fetchLeaderboard,
  fetchLessonModules,
  fetchMyLessonProgress,
  fetchMyStreak,
  fetchDashboardOverview,
  fetchMTSSTiers,
  fetchLessonModule,
  fetchLessonChunk,
  getStudentSkills,
  getObjectiveDistributions,
  getStudentInterventions,
  getDynamicLeaderboard,
  getMyRank,
  getMyAssignments,
  getReceivedReviews,
} from "./api";
import type {
  LeaderboardEntry,
  LessonModuleSummary,
  LessonProgressSummary,
  StreakInfo,
  ClassOverview,
  StudentTierInfo,
  LessonModuleDetail,
  LessonChunkDetail,
  StudentSkillBreakdown,
  ObjectiveDistribution,
  InterventionRecommendation,
  DynamicLeaderboardEntry,
  UserRank,
  PeerReviewAssignment,
  PeerReviewDetail,
} from "./types";

// SWR config: dedupe requests within 5 minutes, don't refetch on window focus
const CACHE_OPTIONS = {
  revalidateOnFocus: false,
  dedupingInterval: 300_000, // 5 minutes
};

export function useLeaderboard() {
  return useSWR<LeaderboardEntry[]>("leaderboard", fetchLeaderboard, CACHE_OPTIONS);
}

export function useLessonModules(enabled = true) {
  return useSWR<LessonModuleSummary[]>(
    enabled ? "lesson-modules" : null,
    fetchLessonModules,
    CACHE_OPTIONS,
  );
}

export function useLessonProgress(enabled = true) {
  return useSWR<LessonProgressSummary>(
    enabled ? "lesson-progress" : null,
    fetchMyLessonProgress,
    CACHE_OPTIONS,
  );
}

export function useStreak(enabled = true) {
  return useSWR<StreakInfo>(
    enabled ? "streak" : null,
    fetchMyStreak,
    CACHE_OPTIONS,
  );
}

export function useDashboardOverview() {
  return useSWR<ClassOverview>("dashboard-overview", fetchDashboardOverview, CACHE_OPTIONS);
}

export function useMTSSTiers() {
  return useSWR<StudentTierInfo[]>("mtss-tiers", fetchMTSSTiers, CACHE_OPTIONS);
}

export function useLessonModule(moduleId: string | null) {
  return useSWR<LessonModuleDetail>(
    moduleId ? `lesson-module-${moduleId}` : null,
    () => fetchLessonModule(moduleId!),
    CACHE_OPTIONS,
  );
}

export function useLessonChunk(chunkId: string | null) {
  return useSWR<LessonChunkDetail>(
    chunkId ? `lesson-chunk-${chunkId}` : null,
    () => fetchLessonChunk(chunkId!),
    CACHE_OPTIONS,
  );
}

// --- Granular MTSS hooks ---

export function useStudentSkills(userId: number | null) {
  return useSWR<StudentSkillBreakdown>(
    userId ? `mtss-student-skills-${userId}` : null,
    () => getStudentSkills(userId!),
    CACHE_OPTIONS,
  );
}

export function useObjectiveDistributions() {
  return useSWR<ObjectiveDistribution[]>(
    "mtss-objectives",
    getObjectiveDistributions,
    CACHE_OPTIONS,
  );
}

export function useStudentInterventions(userId: number | null) {
  return useSWR<InterventionRecommendation[]>(
    userId ? `mtss-interventions-${userId}` : null,
    () => getStudentInterventions(userId!),
    CACHE_OPTIONS,
  );
}

// --- Dynamic Leaderboard hooks ---

export function useDynamicLeaderboard(sortBy: string) {
  return useSWR<DynamicLeaderboardEntry[]>(
    `dynamic-leaderboard-${sortBy}`,
    () => getDynamicLeaderboard(sortBy),
    CACHE_OPTIONS,
  );
}

export function useMyRank() {
  return useSWR<UserRank>("my-rank", getMyRank, CACHE_OPTIONS);
}

// --- Peer Review hooks ---

export function usePeerReviewAssignments() {
  return useSWR<PeerReviewAssignment[]>(
    "peer-review-assignments",
    getMyAssignments,
    CACHE_OPTIONS,
  );
}

export function useReceivedReviews() {
  return useSWR<PeerReviewDetail[]>(
    "peer-review-received",
    getReceivedReviews,
    CACHE_OPTIONS,
  );
}

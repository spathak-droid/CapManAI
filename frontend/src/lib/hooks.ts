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
  fetchMyBadges,
  fetchMySkills,
  getRAGDocuments,
  getStudentRoster,
  getStudentResponses,
  getStudentFeedback,
  fetchStudentPeerReviews,
  fetchAnnouncements,
  fetchActivityFeed,
  fetchEducatorThreads,
  fetchEducatorThread,
  fetchStudentInbox,
  fetchStudentThread,
  fetchUnreadCount,
  fetchEducatorsForStudent,
  fetchTrainingReview,
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
  BadgesResponse,
  MySkillsResponse,
  RAGDocumentSummary,
  StudentRosterEntry,
  StudentResponseEntry,
  StudentPeerReviewData,
  EducatorFeedbackOut,
  AnnouncementOut,
  ActivityFeedItem,
  DirectMessageOut,
  MessageThreadSummary,
  TrainingSessionDetail,
} from "./types";
import { useAuth } from "@/contexts/AuthContext";

// SWR config: stale-while-revalidate — show cached data instantly, refetch in background
const CACHE_OPTIONS = {
  revalidateOnFocus: true,
  revalidateOnMount: true,
  dedupingInterval: 5_000, // dedupe rapid identical requests within 5s
};

/** Return the SWR key only when auth is ready, otherwise null (skip fetch). */
function useAuthKey(key: string): string | null {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return key;
}

export function useLeaderboard() {
  return useSWR<LeaderboardEntry[]>(useAuthKey("leaderboard"), fetchLeaderboard, CACHE_OPTIONS);
}

export function useLessonModules(enabled = true) {
  const authKey = useAuthKey("lesson-modules");
  return useSWR<LessonModuleSummary[]>(
    enabled ? authKey : null,
    fetchLessonModules,
    CACHE_OPTIONS,
  );
}

export function useLessonProgress(enabled = true) {
  const authKey = useAuthKey("lesson-progress");
  return useSWR<LessonProgressSummary>(
    enabled ? authKey : null,
    fetchMyLessonProgress,
    CACHE_OPTIONS,
  );
}

export function useStreak(enabled = true) {
  const authKey = useAuthKey("streak");
  return useSWR<StreakInfo>(
    enabled ? authKey : null,
    fetchMyStreak,
    CACHE_OPTIONS,
  );
}

export function useDashboardOverview() {
  return useSWR<ClassOverview>(useAuthKey("dashboard-overview"), fetchDashboardOverview, CACHE_OPTIONS);
}

export function useMTSSTiers() {
  return useSWR<StudentTierInfo[]>(useAuthKey("mtss-tiers"), fetchMTSSTiers, CACHE_OPTIONS);
}

export function useLessonModule(moduleId: string | null) {
  const authKey = useAuthKey(moduleId ? `lesson-module-${moduleId}` : "");
  return useSWR<LessonModuleDetail>(
    moduleId && authKey ? authKey : null,
    () => fetchLessonModule(moduleId!),
    CACHE_OPTIONS,
  );
}

export function useLessonChunk(chunkId: string | null) {
  const authKey = useAuthKey(chunkId ? `lesson-chunk-${chunkId}` : "");
  return useSWR<LessonChunkDetail>(
    chunkId && authKey ? authKey : null,
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
    useAuthKey("mtss-objectives"),
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
    useAuthKey(`dynamic-leaderboard-${sortBy}`),
    () => getDynamicLeaderboard(sortBy),
    CACHE_OPTIONS,
  );
}

export function useMyRank() {
  return useSWR<UserRank>(useAuthKey("my-rank"), getMyRank, CACHE_OPTIONS);
}

// --- Peer Review hooks ---

export function usePeerReviewAssignments() {
  return useSWR<PeerReviewAssignment[]>(
    useAuthKey("peer-review-assignments"),
    getMyAssignments,
    CACHE_OPTIONS,
  );
}

export function useReceivedReviews() {
  return useSWR<PeerReviewDetail[]>(
    useAuthKey("peer-review-received"),
    getReceivedReviews,
    CACHE_OPTIONS,
  );
}

// --- Badge hooks ---

export function useMyBadges() {
  return useSWR<BadgesResponse>(useAuthKey("my-badges"), fetchMyBadges, CACHE_OPTIONS);
}

// --- Skills hooks ---

export function useMySkills() {
  return useSWR<MySkillsResponse>(useAuthKey("my-skills"), fetchMySkills, CACHE_OPTIONS);
}

// --- Educator Student Roster hooks ---

export function useStudentRoster() {
  return useSWR<StudentRosterEntry[]>(useAuthKey("educator-students"), getStudentRoster, CACHE_OPTIONS);
}

export function useStudentResponses(userId: number | null) {
  return useSWR<StudentResponseEntry[]>(
    userId ? `educator-student-responses-${userId}` : null,
    () => getStudentResponses(userId!),
    CACHE_OPTIONS,
  );
}

export function useStudentFeedbackList(userId: number | null) {
  return useSWR<EducatorFeedbackOut[]>(
    userId ? `educator-student-feedback-${userId}` : null,
    () => getStudentFeedback(userId!),
    CACHE_OPTIONS,
  );
}

export function useStudentPeerReviews(userId: number | null) {
  return useSWR<StudentPeerReviewData>(
    userId ? `educator-student-peer-reviews-${userId}` : null,
    () => fetchStudentPeerReviews(userId!),
    CACHE_OPTIONS,
  );
}

// --- Announcements hooks ---

export function useAnnouncements() {
  return useSWR<AnnouncementOut[]>(useAuthKey("announcements"), fetchAnnouncements, CACHE_OPTIONS);
}

// --- Activity Feed hooks ---

export function useActivityFeed() {
  return useSWR<ActivityFeedItem[]>(useAuthKey("activity-feed"), fetchActivityFeed, CACHE_OPTIONS);
}

// --- Direct Messaging hooks ---

export function useEducatorThreads() {
  return useSWR<MessageThreadSummary[]>(
    useAuthKey("educator-message-threads"),
    fetchEducatorThreads,
    CACHE_OPTIONS,
  );
}

export function useEducatorThread(userId: number | null) {
  return useSWR<DirectMessageOut[]>(
    userId ? `educator-thread-${userId}` : null,
    () => fetchEducatorThread(userId!),
    { ...CACHE_OPTIONS, dedupingInterval: 30_000 },
  );
}

export function useStudentInbox() {
  return useSWR<MessageThreadSummary[]>(
    useAuthKey("student-inbox"),
    fetchStudentInbox,
    CACHE_OPTIONS,
  );
}

export function useStudentThread(educatorId: number | null) {
  return useSWR<DirectMessageOut[]>(
    educatorId ? `student-thread-${educatorId}` : null,
    () => fetchStudentThread(educatorId!),
    { ...CACHE_OPTIONS, dedupingInterval: 30_000 },
  );
}

// --- Educator list for students ---

export function useEducatorsForStudent() {
  return useSWR<{ id: number; username: string; name: string | null }[]>(
    useAuthKey("educators-for-student"),
    fetchEducatorsForStudent,
    CACHE_OPTIONS,
  );
}

// --- Unread Message Count hook ---

export function useUnreadCount() {
  return useSWR<{ unread_count: number }>(
    useAuthKey("unread-message-count"),
    fetchUnreadCount,
    { ...CACHE_OPTIONS, dedupingInterval: 30_000, refreshInterval: 30_000 },
  );
}

// --- RAG Document hooks ---

export function useRAGDocuments() {
  return useSWR<RAGDocumentSummary[]>(useAuthKey("rag-documents"), getRAGDocuments, CACHE_OPTIONS);
}

// --- Training Review hooks ---

export function useTrainingReview() {
  return useSWR<TrainingSessionDetail[]>(useAuthKey("training-review"), fetchTrainingReview, CACHE_OPTIONS);
}

import { auth } from "./firebase";
import type {
  AuthUser,
  Scenario,
  ScenarioParams,
  Grade,
  ProbeResponse,
  ProbeExchange,
  LeaderboardEntry,
  ClassOverview,
  StudentTierInfo,
  LessonModuleSummary,
  LessonModuleDetail,
  LessonChunkDetail,
  QuizAttemptRequest,
  QuizAttemptResponse,
  ChunkCompleteResponse,
  LessonProgressSummary,
  StreakInfo,
  AssistantConversationDetail,
  AssistantConversationListItem,
  AssistantMessagePayload,
  StudentSkillBreakdown,
  ObjectiveDistribution,
  InterventionRecommendation,
  DynamicLeaderboardEntry,
  UserRank,
  ChallengeDetail,
  ChallengeResultDetail,
  OpenChallengeEntry,
  PeerReviewAssignment,
  PeerReviewAssignmentDetail,
  PeerReviewDetail,
  BadgesResponse,
  MySkillsResponse,
  RAGDocumentSummary,
  DocumentIngestResponse,
  StudentRosterEntry,
  StudentResponseEntry,
  EducatorFeedbackOut,
  AnnouncementOut,
  ActivityFeedItem,
  DirectMessageOut,
  MessageThreadSummary,
} from "./types";

/** Backend base URL. Must be set via NEXT_PUBLIC_API_URL (e.g. http://localhost:8000). Sign-in is via Firebase; the backend is only used for GET /api/auth/me after sign-in. */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getApiBaseUrl(): string {
  return API_URL;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (e) {
    const msg =
      e instanceof TypeError && e.message === "Failed to fetch"
        ? "Cannot reach the server. Is the backend running?"
        : e instanceof Error
          ? e.message
          : "Network error";
    throw new ApiError(0, msg);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

export async function generateScenario(
  params?: Partial<ScenarioParams>,
): Promise<Scenario> {
  const body: ScenarioParams = {
    market_regime: params?.market_regime ?? "bull",
    instrument_type: params?.instrument_type ?? "equity",
    complexity: params?.complexity ?? 2,
    skill_target: params?.skill_target ?? "price_action",
  };
  return request<Scenario>("/api/scenarios/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Lesson-aligned scenario: reinforces the chunk, includes ticker and chart-ready market_data */
export async function generateLessonScenario(lessonContext: {
  chunk_title: string;
  learning_goal: string;
  key_takeaway: string;
}): Promise<Scenario> {
  return request<Scenario>("/api/scenarios/generate-lesson", {
    method: "POST",
    body: JSON.stringify({ lesson_context: lessonContext }),
  });
}

export async function submitResponse(
  scenarioText: string,
  analysis: string,
): Promise<ProbeResponse> {
  return request<ProbeResponse>("/api/scenarios/probe", {
    method: "POST",
    body: JSON.stringify({
      scenario_text: scenarioText,
      student_response: analysis,
      num_probes: 2,
    }),
  });
}

export async function submitProbeResponse(
  scenarioText: string,
  studentResponse: string,
  probeExchanges: ProbeExchange[],
  skillTarget?: string,
): Promise<Grade> {
  return request<Grade>("/api/scenarios/grade", {
    method: "POST",
    body: JSON.stringify({
      response_id: 0, // placeholder — backend may assign
      scenario_text: scenarioText,
      student_response: studentResponse,
      probe_exchanges: probeExchanges,
      skill_target: skillTarget ?? "price_action",
    }),
  });
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  return request<LeaderboardEntry[]>("/api/leaderboard?limit=20");
}

export async function fetchDashboardOverview(): Promise<ClassOverview> {
  return request<ClassOverview>("/api/dashboard/overview");
}

export async function fetchMTSSTiers(): Promise<StudentTierInfo[]> {
  return request<StudentTierInfo[]>("/api/mtss/tiers");
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me");
}

export async function fetchCurrentUserWithToken(token: string): Promise<AuthUser> {
  const url = `${API_URL}/api/auth/me`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<AuthUser>;
}

export async function updateRole(role: string): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me/role", {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateProfile(data: { name?: string; role?: string }): Promise<AuthUser> {
  return request<AuthUser>("/api/auth/me/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchLessonModules(): Promise<LessonModuleSummary[]> {
  return request<LessonModuleSummary[]>("/api/lessons/modules");
}

export async function fetchLessonModule(moduleId: string): Promise<LessonModuleDetail> {
  return request<LessonModuleDetail>(`/api/lessons/modules/${moduleId}`);
}

export async function fetchLessonChunk(chunkId: string): Promise<LessonChunkDetail> {
  return request<LessonChunkDetail>(`/api/lessons/chunks/${chunkId}`);
}

export async function submitChunkAttempt(
  chunkId: string,
  payload: QuizAttemptRequest,
): Promise<QuizAttemptResponse> {
  return request<QuizAttemptResponse>(`/api/lessons/chunks/${chunkId}/attempt`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function markChunkComplete(
  chunkId: string,
): Promise<ChunkCompleteResponse> {
  return request<ChunkCompleteResponse>(`/api/lessons/chunks/${chunkId}/complete`, {
    method: "POST",
  });
}

export async function fetchMyLessonProgress(): Promise<LessonProgressSummary> {
  return request<LessonProgressSummary>("/api/lessons/progress/me");
}

export async function fetchMyStreak(): Promise<StreakInfo> {
  return request<StreakInfo>("/api/lessons/streak/me");
}

// --- Assistant (AI chat) API ---

export async function listAssistantConversations(): Promise<
  AssistantConversationListItem[]
> {
  return request<AssistantConversationListItem[]>("/api/assistant/conversations");
}

export async function getAssistantConversation(
  id: number,
): Promise<AssistantConversationDetail> {
  return request<AssistantConversationDetail>(
    `/api/assistant/conversations/${id}`,
  );
}

export async function sendAssistantMessage(
  conversationId: number | null,
  messages: AssistantMessagePayload[],
): Promise<{ conversation_id: number; message: AssistantMessagePayload }> {
  return request<{ conversation_id: number; message: AssistantMessagePayload }>(
    "/api/assistant/chat",
    {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, messages }),
    },
  );
}

export async function renameAssistantConversation(
  id: number,
  title: string,
): Promise<void> {
  await request(`/api/assistant/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteAssistantConversation(id: number): Promise<void> {
  await request(`/api/assistant/conversations/${id}`, {
    method: "DELETE",
  });
}

// --- Granular MTSS API ---

export async function getStudentSkills(userId: number): Promise<StudentSkillBreakdown> {
  return request<StudentSkillBreakdown>(`/api/mtss/student/${userId}/skills`);
}

export async function getObjectiveDistributions(): Promise<ObjectiveDistribution[]> {
  return request<ObjectiveDistribution[]>("/api/mtss/objectives");
}

export async function getStudentInterventions(userId: number): Promise<InterventionRecommendation[]> {
  return request<InterventionRecommendation[]>(`/api/mtss/interventions/${userId}`);
}

// --- Dynamic Leaderboard API ---

export async function getDynamicLeaderboard(
  sortBy?: string,
): Promise<DynamicLeaderboardEntry[]> {
  const query = sortBy ? `?sort_by=${sortBy}` : "";
  return request<DynamicLeaderboardEntry[]>(
    `/api/leaderboard/dynamic${query}`,
  );
}

export async function getMyRank(): Promise<UserRank> {
  return request<UserRank>("/api/leaderboard/me");
}

// --- Challenges API ---

export async function createOpenChallenge(skillTarget?: string): Promise<ChallengeDetail> {
  return request<ChallengeDetail>("/api/challenges/create", {
    method: "POST",
    body: JSON.stringify({ skill_target: skillTarget }),
  });
}

export async function cancelOpenChallenge(challengeId: number): Promise<void> {
  await request(`/api/challenges/cancel/${challengeId}`, { method: "DELETE" });
}

export async function submitChallengeResponse(
  challengeId: number,
  answerText: string,
): Promise<unknown> {
  return request(`/api/challenges/${challengeId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answer_text: answerText }),
  });
}

export async function getChallenge(challengeId: number): Promise<ChallengeDetail> {
  return request<ChallengeDetail>(`/api/challenges/${challengeId}`);
}

export async function getMyChallenges(): Promise<ChallengeDetail[]> {
  return request<ChallengeDetail[]>("/api/challenges/me");
}

export async function getChallengeResult(
  challengeId: number,
): Promise<ChallengeResultDetail> {
  return request<ChallengeResultDetail>(`/api/challenges/${challengeId}/result`);
}

export async function getOpenChallenges(): Promise<OpenChallengeEntry[]> {
  return request<OpenChallengeEntry[]>("/api/challenges/open");
}

export async function acceptChallenge(challengeId: number): Promise<ChallengeDetail> {
  return request<ChallengeDetail>(`/api/challenges/accept/${challengeId}`, {
    method: "POST",
  });
}

// --- Peer Review API ---

export async function getMyAssignments(): Promise<PeerReviewAssignment[]> {
  return request<PeerReviewAssignment[]>("/api/peer-review/assignments");
}

export async function getAssignmentDetail(
  id: number,
): Promise<PeerReviewAssignmentDetail> {
  return request<PeerReviewAssignmentDetail>(
    `/api/peer-review/assignments/${id}`,
  );
}

export async function submitPeerReview(
  assignmentId: number,
  data: {
    technical_accuracy: number;
    risk_awareness: number;
    strategy_fit: number;
    reasoning_clarity: number;
    feedback_text: string;
  },
): Promise<PeerReviewDetail> {
  return request<PeerReviewDetail>(
    `/api/peer-review/assignments/${assignmentId}/submit`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function getReceivedReviews(): Promise<PeerReviewDetail[]> {
  return request<PeerReviewDetail[]>("/api/peer-review/received");
}

export async function rateHelpfulness(
  reviewId: number,
  rating: number,
): Promise<unknown> {
  return request(`/api/peer-review/reviews/${reviewId}/rate`, {
    method: "POST",
    body: JSON.stringify({ rating }),
  });
}

// --- Badges API ---

export async function fetchMyBadges(): Promise<BadgesResponse> {
  return request<BadgesResponse>("/api/badges/me");
}

// --- Skills API ---

export async function fetchMySkills(): Promise<MySkillsResponse> {
  return request<MySkillsResponse>("/api/skills/me");
}

// --- RAG Document Management API ---

export async function getRAGDocuments(): Promise<RAGDocumentSummary[]> {
  return request<RAGDocumentSummary[]>("/api/rag/documents");
}

export async function ingestDocument(
  sourceFile: string,
  content: string,
): Promise<DocumentIngestResponse> {
  return request<DocumentIngestResponse>("/api/rag/ingest", {
    method: "POST",
    body: JSON.stringify({ source_file: sourceFile, content }),
  });
}

export async function deleteRAGDocument(sourceFile: string): Promise<void> {
  await request(`/api/rag/documents/${encodeURIComponent(sourceFile)}`, {
    method: "DELETE",
  });
}

// --- Educator Student Roster API ---

export async function getStudentRoster(): Promise<StudentRosterEntry[]> {
  return request<StudentRosterEntry[]>("/api/educator/students");
}

export async function getStudentResponses(userId: number): Promise<StudentResponseEntry[]> {
  return request<StudentResponseEntry[]>(`/api/educator/students/${userId}/responses`);
}

export async function submitEducatorFeedback(
  responseId: number,
  feedbackText: string,
): Promise<EducatorFeedbackOut> {
  return request<EducatorFeedbackOut>("/api/educator/feedback", {
    method: "POST",
    body: JSON.stringify({ response_id: responseId, feedback_text: feedbackText }),
  });
}

export async function getStudentFeedback(userId: number): Promise<EducatorFeedbackOut[]> {
  return request<EducatorFeedbackOut[]>(`/api/educator/students/${userId}/feedback`);
}

// --- Educator Export API ---

export async function exportEducatorCSV(): Promise<void> {
  const currentUser = auth.currentUser;
  const headers: Record<string, string> = {};
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/api/educator/export/csv`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "student_export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function getOnlineCount(): Promise<{ online_count: number }> {
  return request("/api/challenges/online-count");
}

// --- Announcements API ---

export async function fetchAnnouncements(): Promise<AnnouncementOut[]> {
  return request<AnnouncementOut[]>("/api/educator/announcements");
}

export async function createAnnouncement(
  title: string,
  content: string,
  priority?: string,
): Promise<AnnouncementOut> {
  return request<AnnouncementOut>("/api/educator/announcements", {
    method: "POST",
    body: JSON.stringify({ title, content, priority: priority ?? "normal" }),
  });
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await request(`/api/educator/announcements/${id}`, {
    method: "DELETE",
  });
}

// --- Activity Feed API ---

export async function fetchActivityFeed(): Promise<ActivityFeedItem[]> {
  return request<ActivityFeedItem[]>("/api/educator/activity-feed");
}

// --- Direct Messaging API ---

export async function fetchEducatorThreads(): Promise<MessageThreadSummary[]> {
  return request<MessageThreadSummary[]>("/api/educator/messages/threads");
}

export async function fetchEducatorThread(userId: number): Promise<DirectMessageOut[]> {
  return request<DirectMessageOut[]>(`/api/educator/messages/${userId}`);
}

export async function sendEducatorMessage(recipientId: number, content: string, imageUrl?: string): Promise<DirectMessageOut> {
  return request<DirectMessageOut>("/api/educator/messages", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId, content, image_url: imageUrl }),
  });
}

export async function fetchStudentInbox(): Promise<MessageThreadSummary[]> {
  return request<MessageThreadSummary[]>("/api/messages/inbox");
}

export async function fetchStudentThread(educatorId: number): Promise<DirectMessageOut[]> {
  return request<DirectMessageOut[]>(`/api/messages/thread/${educatorId}`);
}

export async function sendStudentReply(recipientId: number, content: string, imageUrl?: string): Promise<DirectMessageOut> {
  return request<DirectMessageOut>("/api/messages/reply", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId, content, image_url: imageUrl }),
  });
}

export async function fetchEducatorsForStudent(): Promise<{ id: number; username: string; name: string | null }[]> {
  return request("/api/messages/educators");
}

export async function uploadMessageImage(file: File): Promise<{ image_url: string }> {
  const currentUser = auth.currentUser;
  const headers: Record<string, string> = {};
  if (currentUser) {
    const token = await currentUser.getIdToken();
    headers["Authorization"] = `Bearer ${token}`;
  }
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/api/messages/upload-image`, {
    method: "POST",
    headers,
    body: formData,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json();
}

export async function markMessageRead(messageId: number): Promise<void> {
  await request(`/api/messages/${messageId}/read`, {
    method: "PUT",
  });
}

// --- Unread Message Count API ---

export async function fetchUnreadCount(): Promise<{ unread_count: number }> {
  return request<{ unread_count: number }>("/api/messages/unread-count");
}

export { ApiError };

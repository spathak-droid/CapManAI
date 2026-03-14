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
  QueueStatusResponse,
  ChallengeDetail,
  ChallengeResultDetail,
  PeerReviewAssignment,
  PeerReviewAssignmentDetail,
  PeerReviewDetail,
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
): Promise<Grade> {
  return request<Grade>("/api/scenarios/grade", {
    method: "POST",
    body: JSON.stringify({
      response_id: 0, // placeholder — backend may assign
      scenario_text: scenarioText,
      student_response: studentResponse,
      probe_exchanges: probeExchanges,
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

export async function joinQueue(skillTarget?: string): Promise<ChallengeDetail> {
  return request<ChallengeDetail>("/api/challenges/queue", {
    method: "POST",
    body: JSON.stringify({ skill_target: skillTarget }),
  });
}

export async function leaveQueue(): Promise<void> {
  await request("/api/challenges/queue", { method: "DELETE" });
}

export async function getQueueStatus(): Promise<QueueStatusResponse> {
  return request<QueueStatusResponse>("/api/challenges/queue/status");
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

export { ApiError };

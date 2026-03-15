// --- Auth Types ---

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  name: string | null;
  role: string;
  xp_total: number;
  level: number;
}

// --- Scenario Types (aligned with backend API) ---

export interface ScenarioParams {
  market_regime: "bull" | "bear" | "sideways" | "volatile";
  instrument_type: "equity" | "option" | "both";
  complexity: number; // 1-5
  skill_target:
    | "price_action"
    | "options_chain"
    | "strike_select"
    | "risk_mgmt"
    | "position_size"
    | "regime_id"
    | "vol_assess"
    | "trade_mgmt";
}

export interface Scenario {
  situation: string;
  market_data: Record<string, unknown>;
  question: string;
  /** Lesson scenario only: multiple choice options; no LLM grading */
  multiple_choice?: { options: string[]; correct_index: number };
}

export interface ProbeResponse {
  questions: string[];
}

export interface ProbeExchange {
  question: string;
  answer: string;
}

export interface GradeRequest {
  response_id: number;
  scenario_text: string;
  student_response: string;
  probe_exchanges: ProbeExchange[];
  skill_target?: string;
}

export interface SkillScoreInfo {
  score: number;
  attempts: number;
}

export interface MySkillsResponse {
  skills: Record<string, SkillScoreInfo>;
}

export interface Grade {
  technical_accuracy: number;
  risk_awareness: number;
  strategy_fit: number;
  reasoning_clarity: number;
  overall_score: number;
  feedback_text: string;
  xp_earned: number;
}

export interface LeaderboardEntry {
  user_id: number;
  username: string;
  xp_total: number;
  level: number;
  rank: number;
}

// --- Dashboard / MTSS Types (aligned with backend API) ---

/** GET /api/dashboard/overview response */
export interface ClassOverview {
  tier_counts: Record<string, number>;
  students_by_tier: Record<string, string[]>;
  skill_breakdown: Record<string, Record<string, number>>;
}

/** GET /api/mtss/tiers response item */
export interface StudentTierInfo {
  user_id: number;
  username: string;
  overall_tier: string;
  avg_score: number;
  skill_tiers: Record<string, string>;
}

// --- Lessons Types ---

export type LessonTrack = "foundation" | "core" | "capstone";
export type LessonQuizItemType = "mcq" | "scenario" | "reflection";

export interface QuizItemOption {
  id: string;
  text: string;
}

export interface QuizItem {
  item_id: string;
  item_type: LessonQuizItemType;
  prompt: string;
  options: QuizItemOption[];
  correct_option_id?: string | null;
  explanation: string;
  why_it_matters: string;
}

export interface LessonChunkDetail {
  chunk_id: string;
  module_id: string;
  order: number;
  title: string;
  estimated_minutes: number;
  learning_goal: string;
  explain_text: string;
  example_text: string;
  key_takeaway: string;
  common_mistakes: string[];
  quick_check_prompts: string[];
  quiz_items: QuizItem[];
  supplementary_context: string;
}

export interface LessonModuleSummary {
  module_id: string;
  title: string;
  track: LessonTrack;
  order: number;
  objective: string | null;
  estimated_minutes: number;
  prerequisite_ids: string[];
  chunk_ids: string[];
  chunk_count: number;
}

export interface LessonModuleDetail extends LessonModuleSummary {
  chunks: LessonChunkDetail[];
}

export interface LessonItemAnswer {
  item_id: string;
  selected_option_id?: string;
  response_text?: string;
}

export interface QuizAttemptRequest {
  answers: LessonItemAnswer[];
}

export interface QuizItemFeedback {
  item_id: string;
  correct: boolean | null;
  feedback: string;
  why_it_matters: string;
}

export interface QuizAttemptResponse {
  score_percent: number;
  mastered: boolean;
  recommended_retry: boolean;
  attempt_number: number;
  latest_score: number;
  best_score: number;
  item_feedback: QuizItemFeedback[];
  xp_earned: number;
  badges_awarded: string[];
}

export interface ChunkCompleteResponse {
  completed: boolean;
  xp_earned: number;
  badges_awarded: string[];
}

export interface ModuleProgress {
  module_id: string;
  completed_chunks: number;
  total_chunks: number;
  completion_percent: number;
  mastered_chunks: number;
  mastered: boolean;
}

export interface ChunkProgress {
  completed: boolean;
  best_score: number;
  last_score: number;
  mastered: boolean;
  attempts: number;
}

export interface LessonProgressSummary {
  program_completion_percent: number;
  lesson_xp_total: number;
  module_progress: ModuleProgress[];
  chunk_progress: Record<string, ChunkProgress>;
  badges: string[];
  next_module_id: string | null;
  next_chunk_id: string | null;
}

export interface StreakInfo {
  current_streak: number;
  last_activity_date: string | null;
}

// --- Assistant (AI chat) types ---

export interface AssistantMessagePayload {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantConversationListItem {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessageOut {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AssistantConversationDetail {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  messages: AssistantMessageOut[];
}

export interface AssistantChatResponse {
  conversation_id: number;
  message: AssistantMessagePayload;
}

// --- Granular MTSS Types ---

export interface StudentSkillBreakdown {
  user_id: number;
  username: string;
  skills: Record<string, { score: number; tier: string; attempts: number }>;
}

export interface ObjectiveDistribution {
  objective_id: string;
  objective_name: string;
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  total_students: number;
}

export interface InterventionRecommendation {
  skill: string;
  current_tier: string;
  score: number;
  recommendation: string;
  suggested_activities: string[];
}

// --- Dynamic Leaderboard Types ---

export interface DynamicLeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  mastery_score: number;
  repetition_count: number;
  xp_total: number;
  composite_score: number;
}

export interface UserRank {
  user_id: number;
  username: string;
  rank: number;
  mastery_score: number;
  repetition_count: number;
  xp_total: number;
  composite_score: number;
  total_users: number;
}

// --- Challenge Types ---

export interface OpenChallengeEntry {
  challenge_id: number;
  user_id: number;
  username: string;
  skill_target: string | null;
  created_at: string;
}

export interface QueueStatusResponse {
  in_queue: boolean;
  queued_at: string | null;
  skill_target: string | null;
}

export interface ChallengeDetail {
  id: number;
  challenger_id: number;
  opponent_id: number | null;
  status: string;
  skill_target: string | null;
  complexity: number;
  winner_id: number | null;
  created_at: string;
  challenger_submitted?: boolean;
  opponent_submitted?: boolean;
  scenario_text?: string | null;
}

export interface ChallengeResultDetail {
  challenge_id: number;
  winner_id: number | null;
  challenger_grade: Record<string, unknown> | null;
  opponent_grade: Record<string, unknown> | null;
  xp_earned: number;
}

// --- Peer Review Types ---

export interface PeerReviewAssignment {
  id: number;
  reviewer_id: number;
  reviewee_id: number;
  response_id: number;
  status: string;
  due_at: string | null;
  created_at: string;
}

export interface PeerReviewDetail {
  id: number;
  assignment_id: number;
  technical_accuracy: number;
  risk_awareness: number;
  strategy_fit: number;
  reasoning_clarity: number;
  overall_score: number;
  feedback_text: string;
  helpfulness_rating: number | null;
  created_at: string;
}

export interface PeerReviewAssignmentDetail extends PeerReviewAssignment {
  answer_text?: string;
  scenario_situation?: string;
  scenario_question?: string;
  scenario_market_data?: Record<string, unknown>;
}

// --- Educator Student Roster Types ---

export interface StudentRosterEntry {
  id: number;
  username: string;
  name: string | null;
  xp_total: number;
  level: number;
  overall_tier: string;
  avg_skill_score: number;
  response_count: number;
}

export interface StudentResponseEntry {
  response_id: number;
  scenario_situation: string;
  answer_text: string;
  overall_score: number | null;
  technical_accuracy: number | null;
  risk_awareness: number | null;
  strategy_fit: number | null;
  reasoning_clarity: number | null;
  grade_feedback: string | null;
  educator_feedback: string | null;
  educator_feedback_id: number | null;
  created_at: string;
}

export interface EducatorFeedbackOut {
  id: number;
  educator_id: number;
  response_id: number;
  feedback_text: string;
  created_at: string;
}

// --- RAG Document Types ---

export interface RAGDocumentSummary {
  source_file: string;
  chunk_count: number;
  created_at: string;
}

export interface DocumentIngestResponse {
  doc_id: string;
  chunks_created: number;
}

// --- Badge Types ---

export interface BadgeInfo {
  key: string;
  name: string;
  description: string;
  category: "level" | "streak" | "mastery" | "milestone";
  earned: boolean;
}

export interface BadgesResponse {
  badges: BadgeInfo[];
  total_earned: number;
  total_available: number;
}

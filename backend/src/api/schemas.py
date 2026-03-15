"""Pydantic request/response schemas for the CapMan AI API."""

from typing import Literal

from pydantic import BaseModel, Field


class ProbeExchange(BaseModel):
    """A single probe question and the student's answer."""

    question: str
    answer: str


class RespondRequest(BaseModel):
    """Request body for submitting a scenario response."""

    scenario_id: int
    user_id: int
    answer_text: str


class RespondResponse(BaseModel):
    """Response for a submitted scenario answer."""

    response_id: int
    status: str = "received"


class LessonContextSchema(BaseModel):
    """Lesson chunk context for generating an aligned scenario."""

    chunk_title: str
    learning_goal: str
    key_takeaway: str


class LessonScenarioRequest(BaseModel):
    """Request body for generating a lesson-aligned scenario (tickers, charts)."""

    lesson_context: LessonContextSchema


class ProbeRequest(BaseModel):
    """Request body for generating probing questions."""

    scenario_text: str
    student_response: str
    num_probes: int = Field(default=2, ge=1, le=5)


class ProbeResponse(BaseModel):
    """Response containing generated probe questions."""

    questions: list[str]


class GenerateScenarioResponse(BaseModel):
    """Response from scenario generation, includes the persisted scenario_id."""

    scenario_id: int
    situation: str
    market_data: dict[str, object]
    question: str
    multiple_choice: dict[str, object] | None = None


class GradeRequest(BaseModel):
    """Request body for grading a student response."""

    response_id: int
    scenario_text: str
    student_response: str
    probe_exchanges: list[ProbeExchange]
    skill_target: str = "price_action"
    complexity: int = 3


class GradeResult(BaseModel):
    """Result of grading a student response."""

    technical_accuracy: float = Field(ge=1.0, le=5.0)
    risk_awareness: float = Field(ge=1.0, le=5.0)
    strategy_fit: float = Field(ge=1.0, le=5.0)
    reasoning_clarity: float = Field(ge=1.0, le=5.0)
    overall_score: float = Field(ge=1.0, le=5.0)
    feedback_text: str


class GradeResponse(GradeResult):
    """API response for grading, includes XP earned."""

    xp_earned: int


class QuizItemOption(BaseModel):
    """Option used by MCQ/scenario quiz items."""

    id: str
    text: str


class LessonQuizItem(BaseModel):
    """Quiz item delivered inside lesson chunks."""

    item_id: str
    item_type: Literal["mcq", "scenario", "reflection"]
    prompt: str
    options: list[QuizItemOption] = []
    correct_option_id: str | None = None
    explanation: str
    why_it_matters: str


class LessonChunkDetail(BaseModel):
    """Full chunk detail with learning content and quiz items."""

    chunk_id: str
    module_id: str
    order: int
    title: str
    estimated_minutes: int
    learning_goal: str
    explain_text: str
    example_text: str
    key_takeaway: str
    common_mistakes: list[str]
    quick_check_prompts: list[str]
    quiz_items: list[LessonQuizItem]
    supplementary_context: str = ""


class LessonModuleSummary(BaseModel):
    """High-level module record for lesson index page."""

    module_id: str
    title: str
    track: str
    order: int
    objective: str | None = None
    estimated_minutes: int
    prerequisite_ids: list[str]
    chunk_ids: list[str]
    chunk_count: int
    locked: bool = False
    locked_reason: str | None = None


class LessonModuleDetail(LessonModuleSummary):
    """Module details including chunks."""

    chunks: list[LessonChunkDetail]


class LessonItemAnswer(BaseModel):
    """Submitted answer for one quiz item."""

    item_id: str
    selected_option_id: str | None = None
    response_text: str | None = None


class QuizAttemptRequest(BaseModel):
    """Payload for chunk quiz attempts."""

    answers: list[LessonItemAnswer]


class QuizItemFeedback(BaseModel):
    """Feedback for one quiz item."""

    item_id: str
    correct: bool | None = None
    feedback: str
    why_it_matters: str


class QuizAttemptResponse(BaseModel):
    """Attempt scoring response."""

    score_percent: float
    mastered: bool
    recommended_retry: bool
    attempt_number: int
    latest_score: float
    best_score: float
    item_feedback: list[QuizItemFeedback]
    xp_earned: int
    badges_awarded: list[str]


class ChunkCompleteResponse(BaseModel):
    """Response after marking chunk complete."""

    completed: bool
    xp_earned: int
    badges_awarded: list[str]


class ModuleProgress(BaseModel):
    """Progress snapshot for one module."""

    module_id: str
    completed_chunks: int
    total_chunks: int
    completion_percent: float
    mastered_chunks: int
    mastered: bool


class ChunkProgress(BaseModel):
    """Progress snapshot for one chunk."""

    completed: bool
    best_score: float
    last_score: float
    mastered: bool
    attempts: int


class LessonProgressSummary(BaseModel):
    """Aggregate lessons progress for a user."""

    program_completion_percent: float
    lesson_xp_total: int
    module_progress: list[ModuleProgress]
    chunk_progress: dict[str, ChunkProgress]
    badges: list[str]
    next_module_id: str | None = None
    next_chunk_id: str | None = None


class StreakInfo(BaseModel):
    """Daily lesson streak details."""

    current_streak: int
    last_activity_date: str | None = None


# --- Assistant (AI chat) schemas ---


class AssistantMessageSchema(BaseModel):
    """One message in a conversation (for API)."""

    role: Literal["user", "assistant"]
    content: str


class AssistantChatRequest(BaseModel):
    """Request body for POST /api/assistant/chat."""

    conversation_id: int | None = None
    messages: list[AssistantMessageSchema]


class AssistantChatResponse(BaseModel):
    """Response from POST /api/assistant/chat."""

    conversation_id: int
    message: AssistantMessageSchema


class AssistantConversationListItem(BaseModel):
    """One conversation in the list."""

    id: int
    title: str
    created_at: str
    updated_at: str


class AssistantMessageOut(BaseModel):
    """Message as returned from API."""

    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: str


class AssistantConversationDetail(BaseModel):
    """Single conversation with messages (GET /api/assistant/conversations/:id)."""

    id: int
    title: str
    created_at: str
    updated_at: str
    messages: list[AssistantMessageOut]


class AssistantConversationRenameRequest(BaseModel):
    """Body for PATCH /api/assistant/conversations/:id."""

    title: str


# --- Dynamic Leaderboard schemas ---


class DynamicLeaderboardEntry(BaseModel):
    """A single entry on the dynamic leaderboard."""

    rank: int
    user_id: int
    username: str
    mastery_score: float
    repetition_count: int
    xp_total: int
    composite_score: float


class UserRank(BaseModel):
    """Rank details for a single user."""

    user_id: int
    username: str
    rank: int
    mastery_score: float
    repetition_count: int
    xp_total: int
    composite_score: float
    total_users: int


# --- MTSS granular schemas ---


class StudentSkillBreakdown(BaseModel):
    """Detailed skill breakdown for a single student."""

    user_id: int
    username: str
    skills: dict[str, dict[str, object]]  # skill_name -> {score, tier, attempts}


class ObjectiveDistribution(BaseModel):
    """Class-wide tier distribution for a single learning objective."""

    objective_id: str
    objective_name: str
    tier_1_count: int
    tier_2_count: int
    tier_3_count: int
    total_students: int


class InterventionRecommendation(BaseModel):
    """Tier-specific intervention recommendation for a skill."""

    skill: str
    current_tier: str
    score: float
    recommendation: str
    suggested_activities: list[str]


# --- RAG schemas ---


class DocumentIngestRequest(BaseModel):
    """Request body for ingesting a document into the RAG pipeline."""

    source_file: str
    content: str


class DocumentIngestResponse(BaseModel):
    """Response after document ingestion."""

    doc_id: str
    chunks_created: int


class RAGDocumentSummary(BaseModel):
    """Summary of an ingested RAG document (grouped by source_file)."""

    source_file: str
    chunk_count: int
    created_at: str


class RAGSearchResult(BaseModel):
    """A single RAG search result."""

    chunk_id: int
    source_file: str
    content: str
    score: float


class RAGSearchResponse(BaseModel):
    """Response from RAG search endpoint."""

    query: str
    results: list[RAGSearchResult]


# --- Challenge schemas ---


class ScenarioHistoryItem(BaseModel):
    """A single recent scenario in the user's history."""

    scenario_id: int
    market_regime: str
    skill_target: str
    complexity: int
    situation: str
    question: str
    created_at: str


class ScenarioHistoryResponse(BaseModel):
    """Scenario diversity history for a user."""

    total_scenarios: int
    regime_distribution: dict[str, int]
    skill_distribution: dict[str, int]
    recent_scenarios: list[ScenarioHistoryItem]


class QueueJoinRequest(BaseModel):
    """Request to join the matchmaking queue."""

    skill_target: str | None = None


class QueueStatusResponse(BaseModel):
    """Matchmaking queue status for the current user."""

    in_queue: bool
    queued_at: str | None = None
    skill_target: str | None = None


class OpenChallengeEntry(BaseModel):
    """An open challenge waiting for an opponent."""

    challenge_id: int
    user_id: int
    username: str
    skill_target: str | None = None
    created_at: str


class ChallengeSubmitRequest(BaseModel):
    """Request to submit a challenge response."""

    answer_text: str


class ChallengeDetail(BaseModel):
    """Details about a challenge."""

    id: int
    challenger_id: int
    opponent_id: int | None
    status: str
    skill_target: str | None
    complexity: int
    winner_id: int | None
    created_at: str
    challenger_submitted: bool = False
    opponent_submitted: bool = False
    scenario_text: str | None = None


class ChallengeResultDetail(BaseModel):
    """Results of a completed challenge."""

    challenge_id: int
    winner_id: int | None
    challenger_grade: dict[str, object] | None
    opponent_grade: dict[str, object] | None
    xp_earned: int


# --- Peer Review schemas ---


class PeerReviewSubmitRequest(BaseModel):
    """Request body for submitting a peer review."""

    technical_accuracy: float = Field(ge=1.0, le=5.0)
    risk_awareness: float = Field(ge=1.0, le=5.0)
    strategy_fit: float = Field(ge=1.0, le=5.0)
    reasoning_clarity: float = Field(ge=1.0, le=5.0)
    feedback_text: str = Field(min_length=10)


class PeerReviewAssignmentOut(BaseModel):
    """Assignment returned from the API."""

    id: int
    reviewer_id: int
    reviewee_id: int
    response_id: int
    status: str
    due_at: str | None
    created_at: str


class PeerReviewOut(BaseModel):
    """Completed peer review returned from the API."""

    id: int
    assignment_id: int
    technical_accuracy: float
    risk_awareness: float
    strategy_fit: float
    reasoning_clarity: float
    overall_score: float
    feedback_text: str
    helpfulness_rating: int | None
    created_at: str


class HelpfulnessRatingRequest(BaseModel):
    """Request body for rating review helpfulness."""

    rating: int = Field(ge=1, le=5)


# --- Educator Student Roster schemas ---


class StudentRosterEntry(BaseModel):
    """A single student in the educator's roster view."""

    id: int
    username: str
    name: str | None = None
    xp_total: int
    level: int
    overall_tier: str
    avg_skill_score: float
    response_count: int


class StudentResponseEntry(BaseModel):
    """A student's response with grade and feedback info."""

    response_id: int
    scenario_situation: str
    answer_text: str
    overall_score: float | None = None
    technical_accuracy: float | None = None
    risk_awareness: float | None = None
    strategy_fit: float | None = None
    reasoning_clarity: float | None = None
    grade_feedback: str | None = None
    educator_feedback: str | None = None
    educator_feedback_id: int | None = None
    created_at: str


class EducatorFeedbackRequest(BaseModel):
    """Request body for submitting educator feedback."""

    response_id: int
    feedback_text: str = Field(min_length=1)


class EducatorFeedbackOut(BaseModel):
    """Educator feedback returned from the API."""

    id: int
    educator_id: int
    response_id: int
    feedback_text: str
    created_at: str


# --- Badge schemas ---


class BadgeInfo(BaseModel):
    """A single badge definition with earned status."""

    key: str
    name: str
    description: str
    category: Literal["level", "streak", "mastery", "milestone"]
    earned: bool


class BadgeCatalogResponse(BaseModel):
    """Full badge catalog with earned/locked state."""

    badges: list[BadgeInfo]
    total_earned: int
    total_available: int


# --- Announcement schemas ---


class AnnouncementCreate(BaseModel):
    """Request body for creating an announcement."""

    title: str
    content: str
    priority: str = "normal"


class AnnouncementOut(BaseModel):
    """Announcement returned from the API."""

    id: int
    educator_id: int
    educator_name: str
    title: str
    content: str
    priority: str
    created_at: str


# --- Direct Message schemas ---


class DirectMessageCreate(BaseModel):
    """Request body for sending a direct message."""

    recipient_id: int
    content: str


class DirectMessageOut(BaseModel):
    """Direct message returned from the API."""

    id: int
    sender_id: int
    sender_name: str
    recipient_id: int
    recipient_name: str
    content: str
    is_read: bool
    created_at: str


class MessageThreadSummary(BaseModel):
    """Summary of a message thread with another user."""

    user_id: int
    username: str
    name: str | None
    last_message: str
    last_message_at: str
    unread_count: int


class ActivityFeedItem(BaseModel):
    """A single item in the educator activity feed."""

    event_type: str
    user_id: int
    username: str
    description: str
    timestamp: str
    metadata: dict[str, object] = {}

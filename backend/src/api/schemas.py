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


class GradeRequest(BaseModel):
    """Request body for grading a student response."""

    response_id: int
    scenario_text: str
    student_response: str
    probe_exchanges: list[ProbeExchange]


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

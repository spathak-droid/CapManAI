"""Pydantic request/response schemas for the CapMan AI API."""

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

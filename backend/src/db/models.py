"""SQLAlchemy ORM models for CapMan AI."""

from datetime import date, datetime

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base class for all models."""


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    firebase_uid: Mapped[str | None] = mapped_column(
        String(128), unique=True, nullable=True
    )
    username: Mapped[str] = mapped_column(String(100), unique=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)
    role: Mapped[str] = mapped_column(String(20))  # student or educator
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    xp_total: Mapped[int] = mapped_column(default=0)
    level: Mapped[int] = mapped_column(default=1)

    responses: Mapped[list["Response"]] = relationship(back_populates="user")
    skill_scores: Mapped[list["SkillScore"]] = relationship(back_populates="user")
    xp_logs: Mapped[list["XPLog"]] = relationship(back_populates="user")
    chunk_progress: Mapped[list["UserChunkProgress"]] = relationship(back_populates="user")
    streak: Mapped["UserStreak | None"] = relationship(back_populates="user")
    assistant_conversations: Mapped[list["AssistantConversation"]] = relationship(
        back_populates="user"
    )


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    market_regime: Mapped[str] = mapped_column(String(50))
    instrument_type: Mapped[str] = mapped_column(String(50))
    complexity: Mapped[int] = mapped_column()
    skill_target: Mapped[str] = mapped_column(String(50))
    situation: Mapped[str] = mapped_column(Text)
    market_data: Mapped[dict] = mapped_column(JSON)  # type: ignore[assignment]
    question: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    responses: Mapped[list["Response"]] = relationship(back_populates="scenario")


class Response(Base):
    __tablename__ = "responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"))
    answer_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="responses")
    scenario: Mapped["Scenario"] = relationship(back_populates="responses")
    probes: Mapped[list["ProbeQuestion"]] = relationship(back_populates="response")
    grade: Mapped["Grade | None"] = relationship(back_populates="response")


class ProbeQuestion(Base):
    __tablename__ = "probe_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id"))
    question_text: Mapped[str] = mapped_column(Text)
    answer_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    response: Mapped["Response"] = relationship(back_populates="probes")


class Grade(Base):
    __tablename__ = "grades"

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(ForeignKey("responses.id"))
    technical_accuracy: Mapped[float] = mapped_column()
    risk_awareness: Mapped[float] = mapped_column()
    strategy_fit: Mapped[float] = mapped_column()
    reasoning_clarity: Mapped[float] = mapped_column()
    overall_score: Mapped[float] = mapped_column()
    feedback_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    response: Mapped["Response"] = relationship(back_populates="grade")


class SkillScore(Base):
    __tablename__ = "skill_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    skill_id: Mapped[str] = mapped_column(String(50))
    score: Mapped[float] = mapped_column()
    attempts: Mapped[int] = mapped_column(default=0)
    last_updated: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="skill_scores")


class XPLog(Base):
    __tablename__ = "xp_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    amount: Mapped[int] = mapped_column()
    source: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="xp_logs")


class LessonModule(Base):
    __tablename__ = "lesson_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[str] = mapped_column(String(32), unique=True)
    title: Mapped[str] = mapped_column(String(255))
    track: Mapped[str] = mapped_column(String(32))
    order_index: Mapped[int] = mapped_column()
    objective: Mapped[str | None] = mapped_column(String(64), nullable=True)
    estimated_minutes: Mapped[int] = mapped_column()
    prerequisite_ids: Mapped[list[str]] = mapped_column(JSON)  # type: ignore[assignment]


class LessonChunk(Base):
    __tablename__ = "lesson_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    chunk_id: Mapped[str] = mapped_column(String(64), unique=True)
    module_id: Mapped[str] = mapped_column(String(32), ForeignKey("lesson_modules.module_id"))
    order_index: Mapped[int] = mapped_column()
    title: Mapped[str] = mapped_column(String(255))
    estimated_minutes: Mapped[int] = mapped_column()
    learning_goal: Mapped[str] = mapped_column(Text)
    explain_text: Mapped[str] = mapped_column(Text)
    example_text: Mapped[str] = mapped_column(Text)
    key_takeaway: Mapped[str] = mapped_column(Text)
    common_mistakes: Mapped[list[str]] = mapped_column(JSON)  # type: ignore[assignment]
    quick_check_prompts: Mapped[list[str]] = mapped_column(JSON)  # type: ignore[assignment]


class LessonQuizItem(Base):
    __tablename__ = "lesson_quiz_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[str] = mapped_column(String(96), unique=True)
    chunk_id: Mapped[str] = mapped_column(String(64), ForeignKey("lesson_chunks.chunk_id"))
    order_index: Mapped[int] = mapped_column()
    item_type: Mapped[str] = mapped_column(String(32))
    prompt: Mapped[str] = mapped_column(Text)
    options: Mapped[list[dict[str, str]]] = mapped_column(JSON)  # type: ignore[assignment]
    correct_option_id: Mapped[str | None] = mapped_column(String(16), nullable=True)
    explanation: Mapped[str] = mapped_column(Text)
    why_it_matters: Mapped[str] = mapped_column(Text)


class UserChunkProgress(Base):
    __tablename__ = "user_chunk_progress"
    __table_args__ = (UniqueConstraint("user_id", "chunk_id", name="uq_user_chunk"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    chunk_id: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(default=0)
    latest_score: Mapped[float] = mapped_column(default=0.0)
    best_score: Mapped[float] = mapped_column(default=0.0)
    mastered: Mapped[bool] = mapped_column(default=False)
    completed: Mapped[bool] = mapped_column(default=False)
    completion_xp_awarded: Mapped[bool] = mapped_column(default=False)
    mastery_bonus_awarded: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="chunk_progress")


class UserStreak(Base):
    __tablename__ = "user_streaks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    current_streak: Mapped[int] = mapped_column(default=0)
    last_activity_date: Mapped[date | None] = mapped_column(nullable=True)
    lesson_xp_total: Mapped[int] = mapped_column(default=0)

    user: Mapped["User"] = relationship(back_populates="streak")


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255), default="New chat")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        default=datetime.utcnow, onupdate=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="assistant_conversations")
    messages: Mapped[list["AssistantMessage"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("assistant_conversations.id"))
    role: Mapped[str] = mapped_column(String(20))  # 'user' | 'assistant'
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    conversation: Mapped["AssistantConversation"] = relationship(
        back_populates="messages"
    )

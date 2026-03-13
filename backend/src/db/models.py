"""SQLAlchemy ORM models for CapMan AI."""

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
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

"""Initial baseline — all existing tables.

Revision ID: 001_initial
Revises:
Create Date: 2026-03-13

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("firebase_uid", sa.String(128), unique=True, nullable=True),
        sa.Column("username", sa.String(100), unique=True, nullable=False),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("xp_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
    )

    # --- scenarios ---
    op.create_table(
        "scenarios",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("market_regime", sa.String(50), nullable=False),
        sa.Column("instrument_type", sa.String(50), nullable=False),
        sa.Column("complexity", sa.Integer(), nullable=False),
        sa.Column("skill_target", sa.String(50), nullable=False),
        sa.Column("situation", sa.Text(), nullable=False),
        sa.Column("market_data", JSON(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- responses ---
    op.create_table(
        "responses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "scenario_id",
            sa.Integer(),
            sa.ForeignKey("scenarios.id"),
            nullable=False,
        ),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- probe_questions ---
    op.create_table(
        "probe_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "response_id",
            sa.Integer(),
            sa.ForeignKey("responses.id"),
            nullable=False,
        ),
        sa.Column("question_text", sa.Text(), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- grades ---
    op.create_table(
        "grades",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "response_id",
            sa.Integer(),
            sa.ForeignKey("responses.id"),
            nullable=False,
        ),
        sa.Column("technical_accuracy", sa.Float(), nullable=False),
        sa.Column("risk_awareness", sa.Float(), nullable=False),
        sa.Column("strategy_fit", sa.Float(), nullable=False),
        sa.Column("reasoning_clarity", sa.Float(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- skill_scores ---
    op.create_table(
        "skill_scores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("skill_id", sa.String(50), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_updated", sa.DateTime(), nullable=False),
    )

    # --- xp_logs ---
    op.create_table(
        "xp_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    # --- lesson_modules ---
    op.create_table(
        "lesson_modules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("module_id", sa.String(32), unique=True, nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("track", sa.String(32), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("objective", sa.String(64), nullable=True),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("prerequisite_ids", JSON(), nullable=False),
    )

    # --- lesson_chunks ---
    op.create_table(
        "lesson_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chunk_id", sa.String(64), unique=True, nullable=False),
        sa.Column(
            "module_id",
            sa.String(32),
            sa.ForeignKey("lesson_modules.module_id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        sa.Column("learning_goal", sa.Text(), nullable=False),
        sa.Column("explain_text", sa.Text(), nullable=False),
        sa.Column("example_text", sa.Text(), nullable=False),
        sa.Column("key_takeaway", sa.Text(), nullable=False),
        sa.Column("common_mistakes", JSON(), nullable=False),
        sa.Column("quick_check_prompts", JSON(), nullable=False),
    )

    # --- lesson_quiz_items ---
    op.create_table(
        "lesson_quiz_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("item_id", sa.String(96), unique=True, nullable=False),
        sa.Column(
            "chunk_id",
            sa.String(64),
            sa.ForeignKey("lesson_chunks.chunk_id"),
            nullable=False,
        ),
        sa.Column("order_index", sa.Integer(), nullable=False),
        sa.Column("item_type", sa.String(32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("options", JSON(), nullable=False),
        sa.Column("correct_option_id", sa.String(16), nullable=True),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("why_it_matters", sa.Text(), nullable=False),
    )

    # --- user_chunk_progress ---
    op.create_table(
        "user_chunk_progress",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("chunk_id", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latest_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("best_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("mastered", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "completion_xp_awarded",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "mastery_bonus_awarded",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "chunk_id", name="uq_user_chunk"),
    )

    # --- user_streaks ---
    op.create_table(
        "user_streaks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            unique=True,
            nullable=False,
        ),
        sa.Column("current_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_activity_date", sa.Date(), nullable=True),
        sa.Column(
            "lesson_xp_total", sa.Integer(), nullable=False, server_default="0"
        ),
    )

    # --- assistant_conversations ---
    op.create_table(
        "assistant_conversations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "title",
            sa.String(255),
            nullable=False,
            server_default="New chat",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )

    # --- assistant_messages ---
    op.create_table(
        "assistant_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "conversation_id",
            sa.Integer(),
            sa.ForeignKey("assistant_conversations.id"),
            nullable=False,
        ),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("assistant_messages")
    op.drop_table("assistant_conversations")
    op.drop_table("user_streaks")
    op.drop_table("user_chunk_progress")
    op.drop_table("lesson_quiz_items")
    op.drop_table("lesson_chunks")
    op.drop_table("lesson_modules")
    op.drop_table("xp_logs")
    op.drop_table("skill_scores")
    op.drop_table("grades")
    op.drop_table("probe_questions")
    op.drop_table("responses")
    op.drop_table("scenarios")
    op.drop_table("users")

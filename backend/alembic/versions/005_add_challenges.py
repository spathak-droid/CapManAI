"""Add challenges, challenge_responses, and matchmaking_queue tables.

Revision ID: 005_add_challenges
Revises: 004_document_chunks
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "005_add_challenges"
down_revision: Union[str, None] = "004_document_chunks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "challenges",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("challenger_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("opponent_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("scenario_id", sa.Integer(), sa.ForeignKey("scenarios.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("skill_target", sa.String(50), nullable=True),
        sa.Column("complexity", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("winner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "challenge_responses",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "challenge_id",
            sa.Integer(),
            sa.ForeignKey("challenges.id"),
            nullable=False,
        ),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column(
            "submitted_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("grade_id", sa.Integer(), sa.ForeignKey("grades.id"), nullable=True),
    )

    op.create_table(
        "matchmaking_queue",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("skill_target", sa.String(50), nullable=True),
        sa.Column("elo_rating", sa.Float(), nullable=False, server_default="1000.0"),
        sa.Column(
            "queued_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("matched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "challenge_id",
            sa.Integer(),
            sa.ForeignKey("challenges.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("matchmaking_queue")
    op.drop_table("challenge_responses")
    op.drop_table("challenges")

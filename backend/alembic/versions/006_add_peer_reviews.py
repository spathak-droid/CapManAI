"""Add peer_review_assignments and peer_reviews tables.

Revision ID: 006_add_peer_reviews
Revises: 005_add_challenges
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "006_add_peer_reviews"
down_revision: Union[str, None] = "005_add_challenges"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "peer_review_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "reviewer_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "reviewee_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "response_id",
            sa.Integer(),
            sa.ForeignKey("responses.id"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="assigned",
        ),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "peer_reviews",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "assignment_id",
            sa.Integer(),
            sa.ForeignKey("peer_review_assignments.id"),
            nullable=False,
        ),
        sa.Column("technical_accuracy", sa.Float(), nullable=False),
        sa.Column("risk_awareness", sa.Float(), nullable=False),
        sa.Column("strategy_fit", sa.Float(), nullable=False),
        sa.Column("reasoning_clarity", sa.Float(), nullable=False),
        sa.Column("overall_score", sa.Float(), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=False),
        sa.Column("helpfulness_rating", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("peer_reviews")
    op.drop_table("peer_review_assignments")

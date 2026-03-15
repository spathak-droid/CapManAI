"""Add leaderboard_snapshots table.

Revision ID: 003_leaderboard_snapshots
Revises: 002_objective_progress
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "003_leaderboard_snapshots"
down_revision: Union[str, None] = "002_objective_progress"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "leaderboard_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "mastery_score", sa.Float(), nullable=False, server_default="0.0"
        ),
        sa.Column(
            "repetition_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "composite_rank", sa.Float(), nullable=False, server_default="0.0"
        ),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("leaderboard_snapshots")

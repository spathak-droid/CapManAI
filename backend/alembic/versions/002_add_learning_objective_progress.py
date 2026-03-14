"""Add learning_objective_progress table.

Revision ID: 002_objective_progress
Revises: 001_initial
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "002_objective_progress"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "learning_objective_progress",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("objective_id", sa.String(50), nullable=False),
        sa.Column("score_history", JSON(), nullable=True),
        sa.Column(
            "current_tier",
            sa.String(20),
            nullable=False,
            server_default="tier_1",
        ),
        sa.Column(
            "last_assessed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "objective_id", name="uq_user_objective"),
    )


def downgrade() -> None:
    op.drop_table("learning_objective_progress")

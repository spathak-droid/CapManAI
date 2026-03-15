"""Add name column to users table.

Revision ID: 008_user_name
Revises: 007_pgvector
Create Date: 2026-03-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "008_user_name"
down_revision: Union[str, None] = "007_pgvector"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "name")

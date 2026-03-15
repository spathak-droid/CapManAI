"""Make grades.response_id nullable

Revision ID: 82b61bbb3c0f
Revises: 006_add_peer_reviews
Create Date: 2026-03-13 20:40:21.964638

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '82b61bbb3c0f'
down_revision: Union[str, None] = '006_add_peer_reviews'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('grades', 'response_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    op.alter_column('grades', 'response_id',
               existing_type=sa.INTEGER(),
               nullable=False)

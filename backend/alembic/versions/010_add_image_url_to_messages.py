"""Replace image_url with image_data and image_content_type in direct_messages.

Revision ID: 010_image_url
Revises: 009_announcements_messages
Create Date: 2026-03-15

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "010_image_url"
down_revision: Union[str, None] = "009_announcements_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("direct_messages", sa.Column("image_data", sa.LargeBinary(), nullable=True))
    op.add_column("direct_messages", sa.Column("image_content_type", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("direct_messages", "image_content_type")
    op.drop_column("direct_messages", "image_data")

"""Clear old 384-dim embeddings so seed script re-ingests at 1536-dim.

Revision ID: 011_clear_384_embeddings
Revises: 010_image_url
Create Date: 2026-03-15

Embedding model changed from local sentence-transformers (384-dim) to
OpenRouter openai/text-embedding-3-small (1536-dim). Old embeddings stored
as JSON arrays are now the wrong dimension and must be recomputed.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011_clear_384_embeddings"
down_revision: Union[str, None] = "010_image_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clear old 384-dim embeddings. The seed script will re-ingest with
    # 1536-dim embeddings from OpenRouter.
    op.execute("DELETE FROM document_chunks")


def downgrade() -> None:
    # Old embeddings are lost; re-seed to restore.
    pass

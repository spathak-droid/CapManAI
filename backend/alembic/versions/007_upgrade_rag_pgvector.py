"""Clear old toy embeddings so real sentence-transformer embeddings are seeded.

Revision ID: 007_pgvector
Revises: 82b61bbb3c0f
Create Date: 2026-03-14

Note: pgvector is not available on Railway PostgreSQL, so we keep the JSON
column for embedding storage and use Python-side cosine similarity with numpy.
This migration just clears old data so the seed script re-ingests with real
384-dim embeddings from sentence-transformers.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "007_pgvector"
down_revision: Union[str, None] = "82b61bbb3c0f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Clear old document chunks with toy bag-of-words embeddings.
    # The seed script will re-ingest with real sentence-transformer embeddings.
    op.execute("DELETE FROM document_chunks")


def downgrade() -> None:
    # Nothing to undo structurally — the column type hasn't changed.
    # Old toy embeddings are lost but can be re-seeded.
    pass

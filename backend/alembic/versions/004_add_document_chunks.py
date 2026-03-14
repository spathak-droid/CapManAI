"""Add document_chunks table for RAG pipeline.

Revision ID: 004_document_chunks
Revises: 001_initial
Create Date: 2026-03-13

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "004_document_chunks"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("doc_id", sa.String(64), nullable=False),
        sa.Column("source_file", sa.String(512), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", JSON(), nullable=True),
        sa.Column("metadata", JSON(), nullable=True, server_default="{}"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_document_chunks_doc_id", "document_chunks", ["doc_id"])


def downgrade() -> None:
    op.drop_index("ix_document_chunks_doc_id", table_name="document_chunks")
    op.drop_table("document_chunks")

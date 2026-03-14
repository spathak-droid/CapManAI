"""Document ingestion: chunking, embedding, and storage."""

import hashlib
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DocumentChunk
from src.rag.embeddings import compute_embedding

logger = logging.getLogger(__name__)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into roughly chunk_size-character pieces with overlap.

    Args:
        text: The text to split.
        chunk_size: Target size of each chunk in characters.
        overlap: Number of characters to overlap between chunks.

    Returns:
        List of text chunks.
    """
    if not text or not text.strip():
        return []

    text = text.strip()

    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size

        # Try to break at a sentence or word boundary
        if end < len(text):
            # Look for sentence boundary near the end
            for sep in [". ", ".\n", "\n\n", "\n", " "]:
                boundary = text.rfind(sep, start + chunk_size // 2, end)
                if boundary != -1:
                    end = boundary + len(sep)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        # Move forward, accounting for overlap
        start = max(start + 1, end - overlap)

    return chunks


def _generate_doc_id(source_file: str) -> str:
    """Generate a deterministic doc_id from the source file path."""
    return hashlib.sha256(source_file.encode()).hexdigest()[:16]


async def ingest_document(
    db: AsyncSession, source_file: str, content: str
) -> list[DocumentChunk]:
    """Chunk text, compute embeddings, and store in DB.

    Args:
        db: Async database session.
        source_file: Identifier for the source document.
        content: Full text content to ingest.

    Returns:
        List of created DocumentChunk instances.
    """
    doc_id = _generate_doc_id(source_file)

    # Remove existing chunks for this document (re-ingest)
    existing = await db.execute(
        select(DocumentChunk).where(DocumentChunk.doc_id == doc_id)
    )
    for row in existing.scalars().all():
        await db.delete(row)

    chunks = chunk_text(content)
    db_chunks: list[DocumentChunk] = []

    for idx, chunk_content in enumerate(chunks):
        embedding = compute_embedding(chunk_content)
        db_chunk = DocumentChunk(
            doc_id=doc_id,
            source_file=source_file,
            chunk_index=idx,
            content=chunk_content,
            embedding=embedding,
            metadata_={},
        )
        db.add(db_chunk)
        db_chunks.append(db_chunk)

    await db.flush()
    return db_chunks


async def ingest_file(db: AsyncSession, file_path: str) -> list[DocumentChunk]:
    """Read a file from disk and ingest its contents.

    Args:
        db: Async database session.
        file_path: Path to the file to read and ingest.

    Returns:
        List of created DocumentChunk instances.
    """
    with open(file_path) as f:
        content = f.read()
    return await ingest_document(db, source_file=file_path, content=content)

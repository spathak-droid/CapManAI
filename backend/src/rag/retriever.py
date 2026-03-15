"""RAG retrieval: semantic search using sentence-transformer embeddings.

Uses numpy for fast cosine similarity computation in Python.
Embeddings are stored as JSON arrays in PostgreSQL (pgvector not available
on Railway), so similarity is computed application-side.
"""

import logging
import time
from typing import Any

import numpy as np
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DocumentChunk
from src.rag.embeddings import compute_embedding

logger = logging.getLogger(__name__)

# In-memory cache for document chunks (refreshed every 5 minutes)
_chunk_cache: dict[str, Any] = {}
_CHUNK_CACHE_TTL = 300  # seconds


async def _get_chunks(db: AsyncSession) -> list[dict[str, Any]]:
    """Return all document chunks, using a time-based cache."""
    now = time.monotonic()
    if "chunks" in _chunk_cache and now - _chunk_cache.get("ts", 0) < _CHUNK_CACHE_TTL:
        return _chunk_cache["chunks"]  # type: ignore[no-any-return]

    result = await db.execute(select(DocumentChunk))
    chunks = result.scalars().all()
    # Detach from session by extracting the data we need
    cached: list[dict[str, Any]] = []
    for c in chunks:
        cached.append({
            "id": c.id,
            "source_file": c.source_file,
            "content": c.content,
            "embedding": c.embedding,
        })
    _chunk_cache["chunks"] = cached
    _chunk_cache["ts"] = now
    return cached


def invalidate_chunk_cache() -> None:
    """Clear the chunk cache (call after re-seeding)."""
    _chunk_cache.clear()


async def search(
    db: AsyncSession, query: str, top_k: int = 5
) -> list[dict[str, object]]:
    """Embed query and find the top-k most similar document chunks.

    Computes cosine similarity between the query embedding and all stored
    chunk embeddings using numpy for speed.

    Args:
        db: Async database session.
        query: Search query text.
        top_k: Number of results to return.

    Returns:
        List of dicts with chunk_id, source_file, content, and score.
    """
    query_embedding = np.array(compute_embedding(query), dtype=np.float32)

    all_chunks = await _get_chunks(db)

    if not all_chunks:
        return []

    # Filter chunks with embeddings and build matrix for vectorized similarity
    valid_chunks = [c for c in all_chunks if c["embedding"] is not None]
    if not valid_chunks:
        return []

    # Stack all embeddings into a matrix: (n_chunks, 384)
    embeddings_matrix = np.array(
        [c["embedding"] for c in valid_chunks], dtype=np.float32
    )

    # Cosine similarity = dot product (embeddings are already L2-normalized)
    scores = embeddings_matrix @ query_embedding

    # Get top-k indices
    top_indices = np.argsort(scores)[::-1][:top_k]

    return [
        {
            "chunk_id": valid_chunks[i]["id"],
            "source_file": valid_chunks[i]["source_file"],
            "content": valid_chunks[i]["content"],
            "score": round(float(scores[i]), 4),
        }
        for i in top_indices
        if scores[i] > 0
    ]


def _deduplicate_chunks(contents: list[str]) -> list[str]:
    """Remove chunks whose content is substantially contained in another chunk.

    Uses simple string containment: if >50% of a shorter chunk's lines appear
    in a longer chunk, the shorter one is dropped.
    """
    if len(contents) <= 1:
        return contents

    # Sort longest first so we prefer keeping longer chunks
    indexed = sorted(enumerate(contents), key=lambda t: len(t[1]), reverse=True)
    kept_indices: list[int] = []

    for idx, text in indexed:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        if not lines:
            continue

        is_duplicate = False
        for kept_idx in kept_indices:
            kept_text = contents[kept_idx]
            overlap_count = sum(1 for line in lines if line in kept_text)
            if overlap_count / len(lines) > 0.5:
                is_duplicate = True
                break

        if not is_duplicate:
            kept_indices.append(idx)

    # Return in original order
    kept_indices.sort()
    return [contents[i] for i in kept_indices]


async def get_context(
    db: AsyncSession, query: str, top_k: int = 3, *, for_display: bool = False
) -> str:
    """Retrieve and format top-k document chunks as context.

    Args:
        db: Async database session.
        query: Search query text.
        top_k: Number of chunks to include.
        for_display: When True, strip source headers and deduplicate chunks
            for clean UI display.  When False (default), include source
            attribution suitable for LLM grounding.

    Returns:
        Formatted context string, or empty string if no results.
    """
    results = await search(db, query, top_k=top_k)
    if not results:
        return ""

    if for_display:
        contents = [str(r["content"]) for r in results]
        contents = _deduplicate_chunks(contents)
        return "\n\n---\n\n".join(contents)

    parts: list[str] = []
    for i, result in enumerate(results, 1):
        source = result["source_file"]
        content = result["content"]
        parts.append(f"[Source {i}: {source}]\n{content}")

    return "\n\n---\n\n".join(parts)

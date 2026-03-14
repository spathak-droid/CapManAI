"""RAG retrieval: search document chunks by semantic similarity."""

import logging
import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DocumentChunk
from src.rag.embeddings import compute_embedding

logger = logging.getLogger(__name__)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors.

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Cosine similarity score between -1 and 1.
    """
    if len(a) != len(b):
        return 0.0

    dot = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x * x for x in a))
    mag_b = math.sqrt(sum(x * x for x in b))

    if mag_a == 0.0 or mag_b == 0.0:
        return 0.0

    return dot / (mag_a * mag_b)


async def search(
    db: AsyncSession, query: str, top_k: int = 5
) -> list[dict[str, object]]:
    """Embed query and find the top-k most similar document chunks.

    Args:
        db: Async database session.
        query: Search query text.
        top_k: Number of results to return.

    Returns:
        List of dicts with chunk_id, source_file, content, and score.
    """
    query_embedding = compute_embedding(query)

    result = await db.execute(select(DocumentChunk))
    all_chunks = result.scalars().all()

    scored: list[tuple[float, DocumentChunk]] = []
    for chunk in all_chunks:
        if chunk.embedding is None:
            continue
        score = cosine_similarity(query_embedding, chunk.embedding)
        scored.append((score, chunk))

    # Sort by score descending
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "chunk_id": chunk.id,
            "source_file": chunk.source_file,
            "content": chunk.content,
            "score": round(score, 4),
        }
        for score, chunk in scored[:top_k]
    ]


async def get_context(db: AsyncSession, query: str, top_k: int = 3) -> str:
    """Retrieve and format top-k document chunks as context for LLM injection.

    Args:
        db: Async database session.
        query: Search query text.
        top_k: Number of chunks to include.

    Returns:
        Formatted context string, or empty string if no results.
    """
    results = await search(db, query, top_k=top_k)
    if not results:
        return ""

    parts: list[str] = []
    for i, result in enumerate(results, 1):
        source = result["source_file"]
        content = result["content"]
        parts.append(f"[Source {i}: {source}]\n{content}")

    return "\n\n---\n\n".join(parts)

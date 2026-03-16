"""Semantic embedding computation using OpenRouter's embedding API.

Uses openai/text-embedding-3-small (1536 dimensions) via OpenRouter.
"""

import logging
from functools import lru_cache

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "openai/text-embedding-3-small"
EMBEDDING_DIM = 1536

_TIMEOUT = 30.0


def _call_embeddings_api(inputs: list[str]) -> list[list[float]]:
    """Call the OpenRouter embeddings endpoint (OpenAI-compatible format)."""
    url = f"{settings.OPENROUTER_BASE_URL}/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": EMBEDDING_MODEL,
        "input": inputs,
    }
    response = httpx.post(url, json=payload, headers=headers, timeout=_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    # Sort by index to ensure correct ordering
    items = sorted(data["data"], key=lambda x: x["index"])
    return [item["embedding"] for item in items]


@lru_cache(maxsize=128)
def _compute_embedding_cached(text: str) -> tuple[float, ...]:
    """Cached embedding computation. Returns tuple for hashability."""
    vectors = _call_embeddings_api([text])
    return tuple(vectors[0])


def compute_embedding(text: str) -> list[float]:
    """Compute a 1536-dimensional semantic embedding for the given text.

    Returns:
        List of 1536 floats.
    """
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM
    return list(_compute_embedding_cached(text.strip()))


def compute_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Compute embeddings for a batch of texts via a single API call.

    Returns:
        List of embedding vectors, one per input text.
    """
    if not texts:
        return []
    return _call_embeddings_api(texts)

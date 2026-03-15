"""Semantic embedding computation using sentence-transformers.

Uses all-MiniLM-L6-v2 (384 dimensions) — fast, lightweight, good quality.
Model is loaded lazily on first call and cached for the process lifetime.
"""

import logging
from functools import lru_cache

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384


@lru_cache(maxsize=1)
def _get_model():
    """Lazy-load the sentence-transformers model (cached after first call)."""
    from sentence_transformers import SentenceTransformer
    logger.info("Loading embedding model: %s", EMBEDDING_MODEL)
    model = SentenceTransformer(EMBEDDING_MODEL)
    logger.info("Embedding model loaded (dim=%d)", EMBEDDING_DIM)
    return model


@lru_cache(maxsize=128)
def _compute_embedding_cached(text: str) -> tuple[float, ...]:
    """Cached embedding computation. Returns tuple for hashability."""
    model = _get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return tuple(vector.tolist())


def compute_embedding(text: str) -> list[float]:
    """Compute a 384-dimensional semantic embedding for the given text.

    Returns:
        List of 384 floats (L2-normalized by the model).
    """
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM
    return list(_compute_embedding_cached(text.strip()))


def compute_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Compute embeddings for a batch of texts (much faster than one-by-one).

    Returns:
        List of embedding vectors, one per input text.
    """
    if not texts:
        return []
    model = _get_model()
    vectors = model.encode(
        texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False
    )
    return [v.tolist() for v in vectors]

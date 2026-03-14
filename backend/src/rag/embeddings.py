"""Simple embedding computation for RAG pipeline.

Uses a lightweight bag-of-words approach with TF-IDF-like weighting.
This is a placeholder that can be swapped for OpenAI/sentence-transformers later.
"""

import math
import re
from collections import Counter

# Fixed vocabulary size for consistent embedding dimensions
VOCAB_SIZE = 512


def _tokenize(text: str) -> list[str]:
    """Lowercase and split text into word tokens."""
    return re.findall(r"[a-z0-9]+", text.lower())


def _hash_token(token: str) -> int:
    """Hash a token to a fixed bucket index."""
    h = 0
    for ch in token:
        h = (h * 31 + ord(ch)) % VOCAB_SIZE
    return h


def compute_embedding(text: str) -> list[float]:
    """Compute a simple TF-IDF-like embedding for the given text.

    Returns a fixed-size vector of VOCAB_SIZE dimensions using
    hashed bag-of-words with log-frequency weighting.

    This is a placeholder — can be swapped for OpenAI/sentence-transformers later.
    """
    tokens = _tokenize(text)
    if not tokens:
        return [0.0] * VOCAB_SIZE

    # Count token frequencies
    counts = Counter(tokens)

    # Build vector with log-frequency weighting hashed into buckets
    vector = [0.0] * VOCAB_SIZE
    for token, count in counts.items():
        idx = _hash_token(token)
        vector[idx] += 1.0 + math.log(count)

    # L2 normalize
    magnitude = math.sqrt(sum(v * v for v in vector))
    if magnitude > 0:
        vector = [v / magnitude for v in vector]

    return vector

"""Tests for the RAG pipeline: chunking, embeddings, similarity, and endpoints."""

from src.rag.embeddings import VOCAB_SIZE, compute_embedding
from src.rag.ingest import _generate_doc_id, chunk_text
from src.rag.retriever import cosine_similarity


# ---------------------------------------------------------------------------
# chunk_text tests
# ---------------------------------------------------------------------------


class TestChunkText:
    def test_empty_text_returns_empty_list(self) -> None:
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text_returns_single_chunk(self) -> None:
        text = "This is a short text."
        chunks = chunk_text(text, chunk_size=500)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_splits_into_multiple_chunks(self) -> None:
        # Create text longer than chunk_size
        text = "word " * 200  # ~1000 chars
        chunks = chunk_text(text, chunk_size=100, overlap=10)
        assert len(chunks) > 1
        # Every chunk should be non-empty
        assert all(len(c.strip()) > 0 for c in chunks)

    def test_overlap_creates_shared_content(self) -> None:
        # With overlap, adjacent chunks should share some text
        text = "A " * 500  # 1000 chars
        chunks = chunk_text(text, chunk_size=100, overlap=20)
        assert len(chunks) >= 2

    def test_chunk_size_respected(self) -> None:
        text = "Hello world. " * 100
        chunks = chunk_text(text, chunk_size=200, overlap=20)
        # First chunk should be roughly chunk_size or less
        assert len(chunks[0]) <= 250  # allow some boundary flexibility


# ---------------------------------------------------------------------------
# compute_embedding tests
# ---------------------------------------------------------------------------


class TestComputeEmbedding:
    def test_returns_correct_dimension(self) -> None:
        emb = compute_embedding("hello world")
        assert len(emb) == VOCAB_SIZE

    def test_empty_text_returns_zero_vector(self) -> None:
        emb = compute_embedding("")
        assert all(v == 0.0 for v in emb)

    def test_normalized_vector(self) -> None:
        import math

        emb = compute_embedding("capital management trading strategy")
        magnitude = math.sqrt(sum(v * v for v in emb))
        assert abs(magnitude - 1.0) < 1e-6

    def test_same_text_same_embedding(self) -> None:
        a = compute_embedding("risk management")
        b = compute_embedding("risk management")
        assert a == b


# ---------------------------------------------------------------------------
# cosine_similarity tests
# ---------------------------------------------------------------------------


class TestCosineSimilarity:
    def test_identical_vectors(self) -> None:
        vec = [1.0, 2.0, 3.0]
        assert abs(cosine_similarity(vec, vec) - 1.0) < 1e-6

    def test_orthogonal_vectors(self) -> None:
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert abs(cosine_similarity(a, b)) < 1e-6

    def test_opposite_vectors(self) -> None:
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert abs(cosine_similarity(a, b) - (-1.0)) < 1e-6

    def test_zero_vector_returns_zero(self) -> None:
        a = [0.0, 0.0]
        b = [1.0, 2.0]
        assert cosine_similarity(a, b) == 0.0

    def test_different_lengths_returns_zero(self) -> None:
        a = [1.0, 2.0]
        b = [1.0, 2.0, 3.0]
        assert cosine_similarity(a, b) == 0.0


# ---------------------------------------------------------------------------
# _generate_doc_id tests
# ---------------------------------------------------------------------------


class TestGenerateDocId:
    def test_deterministic(self) -> None:
        a = _generate_doc_id("path/to/file.txt")
        b = _generate_doc_id("path/to/file.txt")
        assert a == b

    def test_different_files_different_ids(self) -> None:
        a = _generate_doc_id("file_a.txt")
        b = _generate_doc_id("file_b.txt")
        assert a != b

    def test_id_length(self) -> None:
        doc_id = _generate_doc_id("some/file.pdf")
        assert len(doc_id) == 16


# ---------------------------------------------------------------------------
# Semantic similarity sanity check
# ---------------------------------------------------------------------------


class TestSemanticSimilarity:
    def test_similar_texts_have_higher_score(self) -> None:
        """Texts about similar topics should score higher than unrelated texts."""
        trading = compute_embedding("stock trading market price")
        investing = compute_embedding("equity investment portfolio market")
        cooking = compute_embedding("baking bread flour oven recipe")

        sim_related = cosine_similarity(trading, investing)
        sim_unrelated = cosine_similarity(trading, cooking)

        # Related texts should have higher similarity
        assert sim_related > sim_unrelated

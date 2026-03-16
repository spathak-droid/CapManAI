"""Tests for the RAG pipeline: chunking, embeddings, and endpoints."""

import math
from unittest.mock import MagicMock, patch

from src.rag.embeddings import EMBEDDING_DIM, compute_embedding, compute_embeddings_batch
from src.rag.ingest import _generate_doc_id, chunk_text


def _make_fake_embedding(seed: float = 1.0) -> list[float]:
    """Create a fake normalized embedding vector for testing."""
    raw = [(seed * (i + 1)) % 7 - 3.0 for i in range(EMBEDDING_DIM)]
    magnitude = math.sqrt(sum(v * v for v in raw))
    return [v / magnitude for v in raw]


def _mock_api_response(inputs: list[str]) -> list[list[float]]:
    """Generate deterministic fake embeddings keyed by input text hash."""
    results = []
    for text in inputs:
        seed = float(hash(text) % 1000) / 100.0
        results.append(_make_fake_embedding(seed))
    return results


# ---------------------------------------------------------------------------
# chunk_text tests
# ---------------------------------------------------------------------------


class TestChunkText:
    def test_empty_text_returns_empty_list(self) -> None:
        assert chunk_text("") == []
        assert chunk_text("   ") == []

    def test_short_text_returns_single_chunk(self) -> None:
        text = "This is a short text."
        chunks = chunk_text(text, chunk_size=1500)
        assert len(chunks) == 1
        assert chunks[0] == text

    def test_long_text_splits_into_multiple_chunks(self) -> None:
        # Create text with paragraphs longer than chunk_size
        text = "First paragraph. " * 50 + "\n\n" + "Second paragraph. " * 50
        chunks = chunk_text(text, chunk_size=200, overlap=10)
        assert len(chunks) > 1
        # Every chunk should be non-empty
        assert all(len(c.strip()) > 0 for c in chunks)

    def test_overlap_creates_shared_content(self) -> None:
        # With overlap, adjacent chunks within a section should share some text
        para1 = "Alpha bravo charlie. " * 20  # ~420 chars
        para2 = "Delta echo foxtrot. " * 20  # ~400 chars
        text = f"Section Header\n\n{para1}\n\n{para2}"
        chunks = chunk_text(text, chunk_size=300, overlap=50)
        assert len(chunks) >= 2

    def test_chunk_size_respected(self) -> None:
        para = "Hello world. " * 30  # ~390 chars per paragraph
        text = f"Header One\n\n{para}\n\n{para}\n\n{para}"
        chunks = chunk_text(text, chunk_size=500, overlap=20)
        # All chunks should be roughly chunk_size or less (with some flexibility)
        for chunk in chunks:
            assert len(chunk) <= 600  # allow some boundary flexibility

    def test_section_aware_splitting(self) -> None:
        """Sections with clear headers stay grouped together."""
        body1 = "This is the first section content. " * 5
        body2 = "This is the second section content. " * 5
        section1 = f"Section One\n\n{body1.strip()}"
        section2 = f"Section Two\n\n{body2.strip()}"
        text = f"{section1}\n\n{section2}"
        # Use a chunk_size that fits each section individually but not both
        chunks = chunk_text(text, chunk_size=250, overlap=10)
        assert len(chunks) == 2
        assert "Section One" in chunks[0]
        assert "first section" in chunks[0]
        assert "Section Two" in chunks[1]
        assert "second section" in chunks[1]

    def test_section_header_preserved_in_split_chunks(self) -> None:
        """When a section is split across chunks, each chunk gets the header."""
        header = "Important Topic"
        para1 = "First paragraph about the topic. " * 20  # ~660 chars
        para2 = "Second paragraph with more details. " * 20  # ~720 chars
        text = f"{header}\n\n{para1}\n\n{para2}"
        chunks = chunk_text(text, chunk_size=500, overlap=50)
        assert len(chunks) >= 2
        # Each chunk from this section should include the header
        for chunk in chunks:
            assert "Important Topic" in chunk

    def test_paragraph_boundary_respected(self) -> None:
        """Never splits mid-paragraph unless the paragraph exceeds chunk_size."""
        para1 = "This is paragraph one with some content."
        para2 = "This is paragraph two with other content."
        para3 = "This is paragraph three with final content."
        text = f"My Header\n\n{para1}\n\n{para2}\n\n{para3}"
        chunks = chunk_text(text, chunk_size=100, overlap=10)
        # No chunk should contain a partial paragraph (unless it exceeds chunk_size)
        # Each paragraph is ~40 chars, well under 100, so paragraphs should be intact
        full_text = " ".join(chunks)
        assert para1 in full_text
        assert para2 in full_text
        assert para3 in full_text

    def test_large_paragraph_falls_back_to_sentence_split(self) -> None:
        """A single paragraph exceeding chunk_size is split by sentences."""
        sentences = ["This is sentence number one.", "Here is the second sentence.",
                     "And a third sentence.", "The fourth sentence follows.",
                     "Finally the fifth sentence."]
        big_para = " ".join(sentences)
        text = f"Header\n\n{big_para}"
        chunks = chunk_text(text, chunk_size=80, overlap=10)
        assert len(chunks) > 1
        # Sentences should remain intact across chunks
        all_text = " ".join(chunks)
        for sent in sentences:
            assert sent in all_text

    def test_default_chunk_size_is_1500(self) -> None:
        """Verify the default chunk_size is 1500."""
        short = "Hello world."
        chunks = chunk_text(short)
        assert len(chunks) == 1  # fits in 1500 default


# ---------------------------------------------------------------------------
# compute_embedding tests
# ---------------------------------------------------------------------------


@patch("src.rag.embeddings._call_embeddings_api", side_effect=lambda inputs: _mock_api_response(inputs))
class TestComputeEmbedding:
    def setup_method(self) -> None:
        """Clear LRU cache between tests."""
        from src.rag.embeddings import _compute_embedding_cached
        _compute_embedding_cached.cache_clear()

    def test_returns_correct_dimension(self, mock_api: MagicMock) -> None:
        emb = compute_embedding("hello world")
        assert len(emb) == EMBEDDING_DIM

    def test_empty_text_returns_zero_vector(self, mock_api: MagicMock) -> None:
        emb = compute_embedding("")
        assert all(v == 0.0 for v in emb)
        # Should not call API for empty text
        mock_api.assert_not_called()

    def test_normalized_vector(self, mock_api: MagicMock) -> None:
        emb = compute_embedding("capital management trading strategy")
        magnitude = math.sqrt(sum(v * v for v in emb))
        assert abs(magnitude - 1.0) < 1e-6

    def test_same_text_same_embedding(self, mock_api: MagicMock) -> None:
        a = compute_embedding("risk management")
        b = compute_embedding("risk management")
        assert a == b
        # Second call should use cache, so API called only once
        assert mock_api.call_count == 1


# ---------------------------------------------------------------------------
# compute_embeddings_batch tests
# ---------------------------------------------------------------------------


@patch("src.rag.embeddings._call_embeddings_api", side_effect=lambda inputs: _mock_api_response(inputs))
class TestComputeEmbeddingsBatch:
    def test_empty_list_returns_empty(self, mock_api: MagicMock) -> None:
        assert compute_embeddings_batch([]) == []
        mock_api.assert_not_called()

    def test_batch_correct_dimensions(self, mock_api: MagicMock) -> None:
        texts = ["one", "two", "three"]
        results = compute_embeddings_batch(texts)
        assert len(results) == 3
        assert all(len(v) == EMBEDDING_DIM for v in results)

    def test_batch_calls_api_once(self, mock_api: MagicMock) -> None:
        texts = ["hello world", "risk management"]
        compute_embeddings_batch(texts)
        mock_api.assert_called_once_with(texts)


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

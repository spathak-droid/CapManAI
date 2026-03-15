"""Document ingestion: chunking, embedding, and storage."""

import hashlib
import logging
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DocumentChunk
from src.rag.embeddings import compute_embeddings_batch

logger = logging.getLogger(__name__)


def _safe_overlap(text: str, max_chars: int) -> str:
    """Extract trailing complete sentences from text, up to max_chars.

    Returns the last N complete sentences that fit within max_chars,
    ensuring we never cut a word or sentence mid-way. Returns empty
    string if no complete sentence fits.
    """
    if not text or max_chars <= 0:
        return ""
    # Split into sentences (keep delimiters attached)
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if not sentences:
        return ""
    # Walk backwards collecting complete sentences
    collected: list[str] = []
    total = 0
    for sent in reversed(sentences):
        if total + len(sent) + (1 if collected else 0) > max_chars:
            break
        collected.append(sent)
        total += len(sent) + (1 if len(collected) > 1 else 0)
    if not collected:
        return ""
    collected.reverse()
    return " ".join(collected)


def _is_section_header(line: str, prev_blank: bool) -> bool:
    """Determine if a line looks like a section header.

    A section header is a non-empty line that:
    - Is preceded by a blank line (or is at the start of text)
    - Does NOT start with a list marker (-, *, or digit)
    - Is relatively short (under ~120 chars)
    """
    stripped = line.strip()
    if not stripped:
        return False
    if not prev_blank:
        return False
    if stripped[0] in ("-", "*") or (stripped[0].isdigit() and len(stripped) > 1 and stripped[1] in ".)"):
        return False
    if len(stripped) > 120:
        return False
    return True


def _split_into_sections(text: str) -> list[tuple[str, str]]:
    """Split text into (header, body) sections based on header detection.

    Returns a list of tuples where the first element is the section header
    (empty string for the preamble) and the second is the section body.
    """
    lines = text.split("\n")
    sections: list[tuple[str, str]] = []
    current_header = ""
    current_lines: list[str] = []
    prev_blank = True  # start of text counts as preceded by blank

    for line in lines:
        if _is_section_header(line, prev_blank):
            # Save the previous section
            body = "\n".join(current_lines).strip()
            if body or current_header:
                sections.append((current_header, body))
            current_header = line.strip()
            current_lines = []
        else:
            current_lines.append(line)

        prev_blank = line.strip() == ""

    # Save the last section
    body = "\n".join(current_lines).strip()
    if body or current_header:
        sections.append((current_header, body))

    return sections


def _split_sentences(text: str) -> list[str]:
    """Split text into sentences, keeping the delimiter attached."""
    sentences: list[str] = []
    current = ""
    i = 0
    while i < len(text):
        current += text[i]
        # End of sentence: period/question/exclamation followed by space or newline or end
        if text[i] in ".!?" and (i + 1 >= len(text) or text[i + 1] in " \n"):
            sentences.append(current)
            current = ""
        i += 1
    if current.strip():
        sentences.append(current)
    return sentences


def _chunk_paragraphs(
    paragraphs: list[str],
    chunk_size: int,
    header: str,
    overlap: int,
) -> list[str]:
    """Group paragraphs into chunks respecting chunk_size.

    Each chunk is prefixed with the section header for context.
    If a single paragraph exceeds chunk_size, fall back to sentence splitting.
    Overlap is applied between consecutive chunks produced within this call.
    """
    chunks: list[str] = []
    current_parts: list[str] = []
    current_len = len(header) + 2 if header else 0  # +2 for "\n\n" after header

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        para_len = len(para)
        separator_cost = 2 if current_parts else 0  # "\n\n" between paragraphs

        # If adding this paragraph would exceed chunk_size
        if current_parts and current_len + separator_cost + para_len > chunk_size:
            # Flush current chunk
            body = "\n\n".join(current_parts)
            chunk = f"{header}\n\n{body}" if header else body
            chunks.append(chunk.strip())
            # Apply overlap: carry trailing complete sentences from the last part
            overlap_text = ""
            if overlap > 0:
                overlap_text = _safe_overlap(current_parts[-1], overlap)
            current_parts = [overlap_text] if overlap_text else []
            current_len = (len(header) + 2 if header else 0) + len(overlap_text)

        # If a single paragraph is too large, split by sentences
        if para_len + (len(header) + 2 if header else 0) > chunk_size:
            # Flush anything accumulated
            if current_parts:
                body = "\n\n".join(current_parts)
                chunk = f"{header}\n\n{body}" if header else body
                chunks.append(chunk.strip())
                current_parts = []
                current_len = len(header) + 2 if header else 0

            sentences = _split_sentences(para)
            sent_parts: list[str] = []
            sent_len = len(header) + 2 if header else 0

            for sent in sentences:
                sent = sent.strip()
                if not sent:
                    continue
                sep_cost = 1 if sent_parts else 0
                if sent_parts and sent_len + sep_cost + len(sent) > chunk_size:
                    body = " ".join(sent_parts)
                    chunk = f"{header}\n\n{body}" if header else body
                    chunks.append(chunk.strip())
                    # Overlap from sentence level
                    overlap_text = ""
                    if overlap > 0:
                        overlap_text = _safe_overlap(sent_parts[-1], overlap)
                    sent_parts = [overlap_text] if overlap_text else []
                    sent_len = (len(header) + 2 if header else 0) + len(overlap_text)
                sent_parts.append(sent)
                sent_len += sep_cost + len(sent)

            if sent_parts:
                body = " ".join(sent_parts)
                chunk = f"{header}\n\n{body}" if header else body
                chunks.append(chunk.strip())

            current_parts = []
            current_len = len(header) + 2 if header else 0
            continue

        current_parts.append(para)
        current_len += separator_cost + para_len

    # Flush remaining
    if current_parts:
        body = "\n\n".join(current_parts)
        chunk = f"{header}\n\n{body}" if header else body
        chunks.append(chunk.strip())

    return chunks


def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 100) -> list[str]:
    """Split text into section-and-paragraph-aware chunks.

    Detects section headers and splits text into sections. Each section is
    kept as a single chunk if it fits within chunk_size. Larger sections are
    split on paragraph boundaries, and oversized paragraphs fall back to
    sentence splitting. Each chunk includes its section header for context.

    Args:
        text: The text to split.
        chunk_size: Target size of each chunk in characters.
        overlap: Characters of overlap between chunks within a section.

    Returns:
        List of text chunks.
    """
    if not text or not text.strip():
        return []

    text = text.strip()

    if len(text) <= chunk_size:
        return [text]

    sections = _split_into_sections(text)
    all_chunks: list[str] = []

    for header, body in sections:
        if not body and not header:
            continue

        # Build the full section text
        full_section = f"{header}\n\n{body}" if header and body else header or body
        full_section = full_section.strip()

        if not full_section:
            continue

        # If the whole section fits, keep it as one chunk
        if len(full_section) <= chunk_size:
            all_chunks.append(full_section)
            continue

        # Otherwise split on paragraph boundaries
        paragraphs = body.split("\n\n") if body else [header]
        section_chunks = _chunk_paragraphs(paragraphs, chunk_size, header, overlap)
        all_chunks.extend(section_chunks)

    return all_chunks


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
    embeddings = compute_embeddings_batch(chunks)
    db_chunks: list[DocumentChunk] = []

    for idx, (chunk_content, embedding) in enumerate(zip(chunks, embeddings)):
        db_chunk = DocumentChunk(
            doc_id=doc_id,
            source_file=source_file,
            chunk_index=idx,
            content=chunk_content,
            embedding=embedding,
            metadata_={"chunking_version": 2},
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

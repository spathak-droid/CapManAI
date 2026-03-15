"""Seed RAG documents from the documents directory on startup."""

from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.models import DocumentChunk
from src.rag.ingest import ingest_document

logger = logging.getLogger(__name__)

DOCUMENTS_DIR = Path(__file__).parent / "documents"

# Bump this version whenever the chunking algorithm changes to force a re-seed.
_CHUNKING_VERSION = 3


async def seed_rag_documents(db: AsyncSession, *, force: bool = False) -> None:
    """Ingest all .txt files from the documents directory if the table is empty.

    Skips seeding when DocumentChunk rows already exist (i.e. documents have
    already been ingested), unless force=True which re-ingests everything.
    Automatically re-seeds when the chunking version changes.
    """
    existing_count = (
        await db.execute(select(func.count()).select_from(DocumentChunk))
    ).scalar_one()

    if existing_count > 0 and not force:
        # Check if chunks were created with an older chunking version
        sample = (
            await db.execute(select(DocumentChunk).limit(1))
        ).scalar_one_or_none()
        raw_version = (sample.metadata_ or {}).get("chunking_version", 1) if sample else 1
        stored_version: int = int(raw_version) if isinstance(raw_version, (int, float, str)) else 1
        if stored_version >= _CHUNKING_VERSION:
            logger.info(
                "RAG seed skipped: %d chunks exist (version %d)",
                existing_count,
                stored_version,
            )
            return
        logger.info(
            "RAG chunking version changed (%d -> %d), re-seeding",
            stored_version,
            _CHUNKING_VERSION,
        )
        force = True

    if force and existing_count > 0:
        logger.info("RAG force re-seed: clearing %d existing chunks", existing_count)
        await db.execute(delete(DocumentChunk))
        await db.flush()

    if not DOCUMENTS_DIR.is_dir():
        logger.info("RAG seed skipped: documents directory does not exist")
        return

    txt_files = sorted(DOCUMENTS_DIR.glob("*.txt"))
    if not txt_files:
        logger.info("RAG seed skipped: no .txt files found in documents directory")
        return

    total_chunks = 0
    for txt_file in txt_files:
        content = txt_file.read_text(encoding="utf-8")
        if not content.strip():
            logger.warning("Skipping empty file: %s", txt_file.name)
            continue
        chunks = await ingest_document(
            db, source_file=txt_file.name, content=content
        )
        total_chunks += len(chunks)
        logger.info(
            "Ingested %s: %d chunks created", txt_file.name, len(chunks)
        )

    await db.commit()
    logger.info(
        "RAG seed complete: %d documents, %d total chunks",
        len(txt_files),
        total_chunks,
    )

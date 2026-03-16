"""RAG content management routes: ingest, list, delete, search, reseed."""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.schemas import (
    DocumentIngestRequest,
    DocumentIngestResponse,
    RAGDocumentSummary,
    RAGSearchResponse,
    RAGSearchResult,
)
from src.auth.dependencies import get_current_user, require_role
from src.db.database import get_db
from src.db.models import DocumentChunk, User
from src.rag.ingest import _generate_doc_id, ingest_document
from src.rag.retriever import invalidate_chunk_cache, search as rag_search
from src.rag.seed import seed_rag_documents

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/rag/ingest")
async def rag_ingest(
    req: DocumentIngestRequest,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> DocumentIngestResponse:
    """Ingest a document into the RAG pipeline (educator-only)."""
    chunks = await ingest_document(db, source_file=req.source_file, content=req.content)
    await db.commit()
    doc_id = _generate_doc_id(req.source_file)
    return DocumentIngestResponse(doc_id=doc_id, chunks_created=len(chunks))


@router.get("/api/rag/documents")
async def rag_list_documents(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> list[RAGDocumentSummary]:
    """List all ingested RAG documents grouped by source_file (educator-only)."""
    result = await db.execute(
        select(
            DocumentChunk.source_file,
            func.count().label("chunk_count"),
            func.min(DocumentChunk.created_at).label("created_at"),
        )
        .group_by(DocumentChunk.source_file)
        .order_by(func.min(DocumentChunk.created_at).desc())
    )
    rows = result.all()
    return [
        RAGDocumentSummary(
            source_file=row.source_file,
            chunk_count=row.chunk_count,
            created_at=row.created_at.isoformat() if row.created_at else "",
        )
        for row in rows
    ]


@router.delete("/api/rag/documents/{source_file:path}")
async def rag_delete_document(
    source_file: str,
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Delete all chunks for a given source_file (educator-only)."""
    from sqlalchemy import delete as sa_delete

    result = await db.execute(
        sa_delete(DocumentChunk).where(DocumentChunk.source_file == source_file)
    )
    await db.commit()
    invalidate_chunk_cache()
    deleted = result.rowcount  # type: ignore[union-attr]
    return {"status": "ok", "message": f"Deleted {deleted} chunks for '{source_file}'"}


@router.post("/api/rag/reseed")
async def rag_reseed(
    _user: User = Depends(require_role("educator")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Force re-ingest all RAG documents with the latest chunking algorithm."""
    await seed_rag_documents(db, force=True)
    invalidate_chunk_cache()
    return {"status": "ok", "message": "RAG documents re-seeded with new chunking"}


@router.get("/api/rag/search")
async def rag_search_endpoint(
    q: str,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RAGSearchResponse:
    """Search document chunks by semantic similarity."""
    results = await rag_search(db, query=q, top_k=5)
    return RAGSearchResponse(
        query=q,
        results=[
            RAGSearchResult(
                chunk_id=int(r["chunk_id"]),  # type: ignore[arg-type]
                source_file=str(r["source_file"]),
                content=str(r["content"]),
                score=float(r["score"]),  # type: ignore[arg-type]
            )
            for r in results
        ],
    )

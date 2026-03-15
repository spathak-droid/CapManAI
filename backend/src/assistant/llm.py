"""OpenRouter chat completion for the AI assistant."""

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Return a shared httpx.AsyncClient, creating it on first use."""
    global _http_client  # noqa: PLW0603
    if _http_client is None:
        _http_client = httpx.AsyncClient(timeout=60.0)
    return _http_client

ASSISTANT_SYSTEM_PROMPT = """You are the CapMan AI assistant. You help users with trading concepts, capital management, scenario training, and questions about the CapMan AI app.

Format your replies so they are easy to scan:
- Start with a one- or two-sentence intro, then structure the rest.
- Use **Markdown**: short headings (##), bullet lists for key points, **bold** for important terms.
- Keep paragraphs short (2–3 sentences). Prefer bullets over long paragraphs.
- For comparisons (e.g. bullish vs bearish), use a bullet list or a short table in markdown.
- Optionally include a simple diagram in a fenced code block with language "mermaid" (e.g. a small flowchart) when it helps—we will render it.
- End with a brief takeaway or "In practice" when useful.

Be concise, accurate, and supportive. When relevant, tie answers to lessons or scenario training."""

EDUCATOR_SYSTEM_PROMPT = """You are the CapMan AI assistant helping an educator analyze student performance.

You have access to detailed student data including skill scores, MTSS tier classification, recent grades, and peer review activity.

Your role:
- Provide data-backed analysis of student strengths and weaknesses
- Suggest MTSS-aligned interventions (Tier 1: enrichment, Tier 2: targeted support, Tier 3: intensive intervention)
- Identify trends in student performance over time
- Highlight areas where the student excels and where they need support
- Recommend specific actions the educator can take
- Reference actual scores and data in your responses

Format your replies so they are easy to scan:
- Start with a brief assessment, then structure the rest.
- Use **Markdown**: short headings (##), bullet lists for key points, **bold** for important terms.
- Keep paragraphs short (2–3 sentences). Prefer bullets over long paragraphs.
- End with actionable next steps for the educator.

Be concise, evidence-based, and actionable."""


async def chat_completion(
    messages: list[dict[str, str]],
    rag_context: str | None = None,
) -> str:
    """Call OpenRouter chat completions with the given messages; returns assistant content.

    Args:
        messages: List of message dicts with 'role' and 'content'.
        rag_context: Optional RAG context to prepend to the system message.
    """
    api_key = settings.openrouter_api_key
    if not api_key:
        logger.error(
            "OPENROUTER_API_KEY (or OPEN_ROUTER_API_KEY) is not set in backend .env"
        )
        raise ValueError(
            "OpenRouter API key not set. Add OPENROUTER_API_KEY to backend/.env and restart."
        )

    # Optionally inject RAG context into the system message
    if rag_context:
        enriched_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                enriched_msg = dict(msg)
                enriched_msg["content"] = (
                    f"Use the following reference material:\n{rag_context}\n\n"
                    + msg["content"]
                )
                enriched_messages.append(enriched_msg)
            else:
                enriched_messages.append(msg)
        messages = enriched_messages

    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": 0.4,
    }
    client = _get_http_client()
    resp = await client.post(url, headers=headers, json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"]  # type: ignore[no-any-return]


async def chat_completion_stream(
    messages: list[dict[str, str]],
    rag_context: str | None = None,
) -> AsyncIterator[str]:
    """Stream chat completion tokens from OpenRouter. Yields content delta strings."""
    api_key = settings.openrouter_api_key
    if not api_key:
        raise ValueError("OpenRouter API key not set.")

    # Same RAG context injection as chat_completion
    if rag_context:
        enriched_messages: list[dict[str, str]] = []
        for msg in messages:
            if msg["role"] == "system":
                enriched_msg = dict(msg)
                enriched_msg["content"] = (
                    f"Use the following reference material:\n{rag_context}\n\n"
                    + msg["content"]
                )
                enriched_messages.append(enriched_msg)
            else:
                enriched_messages.append(msg)
        messages = enriched_messages

    url = f"{settings.OPENROUTER_BASE_URL}/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload: dict[str, Any] = {
        "model": settings.openrouter_model,
        "messages": messages,
        "temperature": 0.4,
        "stream": True,
    }
    client = _get_http_client()
    async with client.stream("POST", url, headers=headers, json=payload) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line.startswith("data: "):
                continue
            data_str = line[6:]
            if data_str.strip() == "[DONE]":
                break
            try:
                chunk = json.loads(data_str)
            except json.JSONDecodeError:
                continue
            delta = chunk.get("choices", [{}])[0].get("delta", {})
            content = delta.get("content")
            if content:
                yield content

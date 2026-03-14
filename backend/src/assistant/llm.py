"""OpenRouter chat completion for the AI assistant."""

import logging
from typing import Any

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

ASSISTANT_SYSTEM_PROMPT = """You are the CapMan AI assistant. You help users with trading concepts, capital management, scenario training, and questions about the CapMan AI app.

Format your replies so they are easy to scan:
- Start with a one- or two-sentence intro, then structure the rest.
- Use **Markdown**: short headings (##), bullet lists for key points, **bold** for important terms.
- Keep paragraphs short (2–3 sentences). Prefer bullets over long paragraphs.
- For comparisons (e.g. bullish vs bearish), use a bullet list or a short table in markdown.
- Optionally include a simple diagram in a fenced code block with language "mermaid" (e.g. a small flowchart) when it helps—we will render it.
- End with a brief takeaway or "In practice" when useful.

Be concise, accurate, and supportive. When relevant, tie answers to lessons or scenario training."""


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
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]  # type: ignore[no-any-return]

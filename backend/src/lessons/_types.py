"""Shared dataclasses for lesson content definitions.

Extracted to avoid circular imports between service.py and chunk builder modules.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class QuizItemDef:
    """Single quiz item definition."""

    item_id: str
    item_type: str
    prompt: str
    options: list[dict[str, str]]
    correct_option_id: str | None
    explanation: str
    why_it_matters: str


@dataclass(frozen=True)
class ChunkDef:
    """Lesson chunk definition."""

    chunk_id: str
    module_id: str
    order: int
    title: str
    estimated_minutes: int
    learning_goal: str
    explain_text: str
    example_text: str
    key_takeaway: str
    common_mistakes: list[str]
    quick_check_prompts: list[str]
    quiz_items: list[QuizItemDef]


@dataclass(frozen=True)
class ModuleDef:
    """Lesson module definition."""

    module_id: str
    title: str
    track: str
    order: int
    objective: str | None
    estimated_minutes: int
    prerequisite_ids: list[str]
    chunk_ids: list[str]

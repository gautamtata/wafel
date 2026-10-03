from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import TypedDict

from livekit import rtc
from livekit.agents import function_tool
from livekit.agents.llm.tool_context import FunctionTool

from wafel_agent.api import WafelApi
from wafel_agent.brief import MistakeCategory, TargetKind

logger = logging.getLogger("wafel.tools")

NOTE_TOPIC = "wafel.note"
PHRASE_TOPIC = "wafel.phrase"
SCORE_RANGE = range(0, 4)

RequestEnd = Callable[[str], Awaitable[None]]


class ToolResult(TypedDict, total=False):
    ok: bool
    error: str


def _result(ok: bool) -> ToolResult:
    return {"ok": ok}


def _error(message: str) -> ToolResult:
    return {"ok": False, "error": message}


def _validate_rating(kind: str, score: int) -> tuple[TargetKind, int] | ToolResult:
    try:
        target_kind = TargetKind(kind.strip().upper())
    except ValueError:
        return _error(f"kind must be WORD or PATTERN, got {kind!r}")
    if score not in SCORE_RANGE:
        return _error(f"score must be an integer from 0 to 3, got {score!r}")
    return target_kind, score


def _category(value: str) -> MistakeCategory:
    try:
        return MistakeCategory(value.strip().upper())
    except ValueError:
        logger.warning("unknown mistake category %r, using OTHER", value)
        return MistakeCategory.OTHER


async def _publish(room: rtc.Room, topic: str, payload: dict[str, str]) -> ToolResult:
    try:
        await room.local_participant.publish_data(
            json.dumps(payload).encode(), reliable=True, topic=topic
        )
    except Exception as exc:
        logger.warning("%s publish failed: %s", topic, exc)
        return _result(False)
    return _result(True)


def build_tools(
    session_id: str, api: WafelApi, room: rtc.Room, request_end: RequestEnd
) -> list[FunctionTool]:
    @function_tool(name="save_vocab")
    async def save_vocab(word: str, translation: str, example: str | None = None) -> ToolResult:
        """Save a vocabulary word the learner asked about, learned, or used well.

        Args:
            word: The Spanish word or short phrase.
            translation: Its meaning in the learner's native language.
            example: Optional short Spanish example sentence using the word.
        """
        return _result(await api.save_vocab(session_id, word, translation, example))

    @function_tool(name="log_mistake")
    async def log_mistake(
        original: str, corrected: str, explanation: str, category: str
    ) -> ToolResult:
        """Record a clear learner mistake so it can be reviewed later.

        Args:
            original: What the learner said.
            corrected: The correct form.
            explanation: One short sentence explaining the rule.
            category: One of GRAMMAR, VOCABULARY, WORD_ORDER, AGREEMENT, CONJUGATION,
                PRONUNCIATION, OTHER.
        """
        ok = await api.log_mistake(
            session_id, original, corrected, explanation, _category(category)
        )
        return _result(ok)

    @function_tool(name="show_note")
    async def show_note(title: str, body: str) -> ToolResult:
        """Show a short on-screen note card to the learner (a rule, table, or phrase list).

        Args:
            title: Short card title.
            body: Plain-text body, under 400 characters.
        """
        return await _publish(room, NOTE_TOPIC, {"type": "note", "title": title, "body": body})

    @function_tool(name="show_phrase")
    async def show_phrase(spanish: str, english: str) -> ToolResult:
        """Show a phrase card on screen: the Spanish line with its English meaning.

        Call it for every phrase you present or ask the learner to repeat.

        Args:
            spanish: The exact Spanish phrase or word.
            english: Its English translation.
        """
        return await _publish(
            room, PHRASE_TOPIC, {"type": "phrase", "spanish": spanish, "english": english}
        )

    @function_tool(name="rate_attempt")
    async def rate_attempt(
        target: str, kind: str, score: int, note: str | None = None
    ) -> ToolResult:
        """Grade the learner's attempt at a unit target word, or the unit pattern at the end.

        Args:
            target: The unit's target word string exactly as listed (verbatim), or the
                pattern name for kind PATTERN.
            kind: WORD or PATTERN.
            score: 0 (no attempt / unintelligible), 1 (serious errors),
                2 (understandable with a slip), 3 (correct and natural).
            note: Optional short remark about the attempt.
        """
        validated = _validate_rating(kind, score)
        if isinstance(validated, dict):
            return validated
        target_kind, valid_score = validated
        return _result(await api.rate_attempt(session_id, target, target_kind, valid_score, note))

    @function_tool(name="end_lesson")
    async def end_lesson(reason: str) -> ToolResult:
        """End the lesson after the tutor has said goodbye.

        Args:
            reason: Why the lesson is ending (learner said goodbye, asked to stop, ...).
        """
        await request_end(reason)
        return _result(True)

    return [save_vocab, log_mistake, show_note, show_phrase, rate_attempt, end_lesson]

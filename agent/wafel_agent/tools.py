from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import TypedDict

from livekit import rtc
from livekit.agents import function_tool
from livekit.agents.llm.tool_context import FunctionTool

from wafel_agent.api import WafelApi
from wafel_agent.brief import MistakeCategory

logger = logging.getLogger("wafel.tools")

NOTE_TOPIC = "wafel.note"

RequestEnd = Callable[[str], Awaitable[None]]


class ToolResult(TypedDict):
    ok: bool


def _result(ok: bool) -> ToolResult:
    return {"ok": ok}


def _category(value: str) -> MistakeCategory:
    try:
        return MistakeCategory(value.strip().upper())
    except ValueError:
        logger.warning("unknown mistake category %r, using OTHER", value)
        return MistakeCategory.OTHER


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
        payload = json.dumps({"type": "note", "title": title, "body": body}).encode()
        try:
            await room.local_participant.publish_data(payload, reliable=True, topic=NOTE_TOPIC)
        except Exception as exc:
            logger.warning("show_note publish failed: %s", exc)
            return _result(False)
        return _result(True)

    @function_tool(name="end_lesson")
    async def end_lesson(reason: str) -> ToolResult:
        """End the lesson after the tutor has said goodbye.

        Args:
            reason: Why the lesson is ending (learner said goodbye, asked to stop, ...).
        """
        await request_end(reason)
        return _result(True)

    return [save_vocab, log_mistake, show_note, end_lesson]

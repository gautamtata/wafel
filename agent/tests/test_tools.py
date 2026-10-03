import json
from dataclasses import dataclass, field
from typing import Any

import pytest
from livekit.agents.llm.tool_context import FunctionTool

from wafel_agent.brief import MistakeCategory
from wafel_agent.prompts import TOOL_NAMES
from wafel_agent.tools import build_tools


@dataclass
class FakeApi:
    vocab_ok: bool = True
    mistake_ok: bool = True
    vocab_calls: list[tuple[Any, ...]] = field(default_factory=list)
    mistake_calls: list[tuple[Any, ...]] = field(default_factory=list)

    async def save_vocab(
        self, session_id: str, word: str, translation: str, example: str | None = None
    ) -> bool:
        self.vocab_calls.append((session_id, word, translation, example))
        return self.vocab_ok

    async def log_mistake(
        self,
        session_id: str,
        original: str,
        corrected: str,
        explanation: str,
        category: MistakeCategory,
    ) -> bool:
        self.mistake_calls.append((session_id, original, corrected, explanation, category))
        return self.mistake_ok


@dataclass
class FakeLocalParticipant:
    published: list[dict[str, Any]] = field(default_factory=list)

    async def publish_data(
        self,
        payload: bytes | str,
        *,
        reliable: bool = True,
        destination_identities: list[str] | None = None,
        topic: str = "",
    ) -> None:
        self.published.append({"payload": payload, "reliable": reliable, "topic": topic})


@dataclass
class FakeRoom:
    local_participant: FakeLocalParticipant = field(default_factory=FakeLocalParticipant)


@pytest.fixture
def harness() -> tuple[dict[str, FunctionTool], FakeApi, FakeRoom, list[str]]:
    api = FakeApi()
    room = FakeRoom()
    ends: list[str] = []

    async def request_end(reason: str) -> None:
        ends.append(reason)

    tools = build_tools("sess-1", api, room, request_end)  # type: ignore[arg-type]
    return {t.info.name: t for t in tools}, api, room, ends


def test_tool_names_and_descriptions(harness: tuple) -> None:
    tools, *_ = harness
    assert tuple(tools) == TOOL_NAMES
    for tool in tools.values():
        assert isinstance(tool, FunctionTool)
        assert tool.info.description


async def test_save_vocab_calls_api(harness: tuple) -> None:
    tools, api, *_ = harness
    result = await tools["save_vocab"](
        word="la cuenta", translation="the bill", example="¿La cuenta?"
    )
    assert result == {"ok": True}
    assert api.vocab_calls == [("sess-1", "la cuenta", "the bill", "¿La cuenta?")]


async def test_save_vocab_reports_failure(harness: tuple) -> None:
    tools, api, *_ = harness
    api.vocab_ok = False
    assert await tools["save_vocab"](word="x", translation="y") == {"ok": False}


async def test_log_mistake_calls_api_with_enum(harness: tuple) -> None:
    tools, api, *_ = harness
    result = await tools["log_mistake"](
        original="yo come", corrected="yo como", explanation="1st person", category="CONJUGATION"
    )
    assert result == {"ok": True}
    assert api.mistake_calls[0][4] is MistakeCategory.CONJUGATION


async def test_log_mistake_unknown_category_maps_to_other(harness: tuple) -> None:
    tools, api, *_ = harness
    await tools["log_mistake"](original="a", corrected="b", explanation="c", category="WEIRD")
    assert api.mistake_calls[0][4] is MistakeCategory.OTHER


async def test_show_note_publishes_data(harness: tuple) -> None:
    tools, _, room, _ = harness
    result = await tools["show_note"](title="Ser vs estar", body="ser = identidad; estar = estado")
    assert result == {"ok": True}
    [msg] = room.local_participant.published
    assert msg["reliable"] is True
    assert msg["topic"] == "wafel.note"
    assert json.loads(msg["payload"]) == {
        "type": "note",
        "title": "Ser vs estar",
        "body": "ser = identidad; estar = estado",
    }


async def test_show_note_reports_publish_failure(harness: tuple) -> None:
    tools, _, room, _ = harness

    async def boom(payload: bytes | str, *, reliable: bool = True, topic: str = "") -> None:
        raise RuntimeError("disconnected")

    room.local_participant.publish_data = boom  # type: ignore[method-assign]
    assert await tools["show_note"](title="t", body="b") == {"ok": False}


async def test_end_lesson_requests_end(harness: tuple) -> None:
    tools, _, _, ends = harness
    result = await tools["end_lesson"](reason="learner said goodbye")
    assert result == {"ok": True}
    assert ends == ["learner said goodbye"]

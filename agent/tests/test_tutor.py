import asyncio
from dataclasses import dataclass, field
from typing import Any

import pytest
from livekit.agents.llm import AgentHandoff, ChatMessage
from livekit.agents.voice.events import ConversationItemAddedEvent

from wafel_agent.brief import Brief
from wafel_agent.prompts import build_voice_prompt
from wafel_agent.tutor import LessonLifecycle, TranscriptLog, WafelTutor


@dataclass
class FakeApi:
    ended_calls: list[tuple[str, list[dict[str, Any]], int]] = field(default_factory=list)

    async def ended(
        self, session_id: str, transcript: list[dict[str, Any]], duration_sec: int
    ) -> None:
        self.ended_calls.append((session_id, transcript, duration_sec))


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def _event(role: str, text: str) -> ConversationItemAddedEvent:
    return ConversationItemAddedEvent(item=ChatMessage(role=role, content=[text]))  # type: ignore[arg-type]


def test_transcript_log_append_and_entries() -> None:
    elapsed = iter([1.26, 4.0])
    log = TranscriptLog(elapsed=lambda: next(elapsed))
    log.append("tutor", "Hola")
    log.append("learner", "Buenas")
    assert log.entries() == [
        {"role": "tutor", "text": "Hola", "t": 1.3},
        {"role": "learner", "text": "Buenas", "t": 4.0},
    ]
    assert log.entries() is not log.entries()


def test_transcript_log_defaults_t_to_zero() -> None:
    log = TranscriptLog()
    log.append("tutor", "Hola")
    assert log.entries() == [{"role": "tutor", "text": "Hola", "t": 0.0}]


def test_transcript_log_on_item_maps_chat_roles_to_contract() -> None:
    log = TranscriptLog()
    log.on_item(_event("assistant", "¿Qué tal?"))
    log.on_item(_event("user", "Bien"))
    log.on_item(_event("system", "ignored"))
    log.on_item(_event("assistant", "   "))
    log.on_item(ConversationItemAddedEvent(item=AgentHandoff(old_agent_id="a", new_agent_id="b")))
    assert log.entries() == [
        {"role": "tutor", "text": "¿Qué tal?", "t": 0.0},
        {"role": "learner", "text": "Bien", "t": 0.0},
    ]


def test_tutor_uses_voice_prompt_and_tools(brief: Brief) -> None:
    tutor = WafelTutor(brief, tools=[])
    assert tutor.instructions == build_voice_prompt(brief)
    assert tutor.tools == []


@pytest.fixture
def lifecycle(brief: Brief) -> tuple[LessonLifecycle, FakeApi, list[str], FakeClock]:
    api = FakeApi()
    reasons: list[str] = []
    clock = FakeClock()
    lc = LessonLifecycle(
        brief,
        api,
        shutdown=reasons.append,
        end_delay=0.0,
        clock=clock,  # type: ignore[arg-type]
    )
    return lc, api, reasons, clock


async def test_post_ended_without_end_lesson(lifecycle: tuple) -> None:
    lc, api, reasons, clock = lifecycle
    clock.now += 30.0
    task = lc.mark_started()
    clock.now += 2.5
    lc.transcript.on_item(_event("assistant", "Hola"))
    clock.now += 92.9
    await lc.post_ended()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert reasons == []
    assert api.ended_calls == [
        ("sample-session", [{"role": "tutor", "text": "Hola", "t": 2.5}], 95)
    ]


def test_duration_is_zero_before_mark_started(lifecycle: tuple) -> None:
    lc, _, _, clock = lifecycle
    clock.now += 500.0
    assert lc.duration_sec == 0
    assert lc.elapsed() == 0.0


async def test_duration_counts_from_mark_started(lifecycle: tuple) -> None:
    lc, _, _, clock = lifecycle
    clock.now += 500.0
    lc.mark_started()
    clock.now += 61.9
    assert lc.duration_sec == 61
    lc.cancel()


async def test_request_end_shuts_down_once(lifecycle: tuple) -> None:
    lc, _, reasons, _ = lifecycle
    await lc.request_end("goodbye")
    await lc.request_end("again")
    assert reasons == ["goodbye"]


async def test_cap_timer_requests_end(brief: Brief) -> None:
    api = FakeApi()
    reasons: list[str] = []
    lc = LessonLifecycle(brief, api, shutdown=reasons.append, end_delay=0.0, cap_seconds=0.01)  # type: ignore[arg-type]
    task = lc.mark_started()
    await asyncio.wait_for(task, timeout=1)
    assert reasons == ["cap"]


async def test_cancel_stops_cap_timer(brief: Brief) -> None:
    lc = LessonLifecycle(brief, FakeApi(), shutdown=lambda _: None, cap_seconds=60)  # type: ignore[arg-type]
    task = lc.mark_started()
    lc.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

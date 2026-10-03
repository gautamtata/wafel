import asyncio
from collections.abc import Callable, Generator
from dataclasses import dataclass, field
from types import SimpleNamespace
from typing import Any

import pytest
from livekit.agents.llm import AgentHandoff, ChatMessage
from livekit.agents.voice.events import ConversationItemAddedEvent

from wafel_agent.brief import Brief
from wafel_agent.prompts import build_voice_prompt
from wafel_agent.tutor import (
    GREETING_INSTRUCTION,
    LEARNER_LEFT_REASON,
    LearnerPresence,
    LessonLifecycle,
    TranscriptLog,
    WafelTutor,
)


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


@dataclass
class FakeParticipant:
    identity: str


ParticipantHandler = Callable[[FakeParticipant], None]


class FakeRoom:
    def __init__(self) -> None:
        self.handlers: dict[str, ParticipantHandler] = {}

    def on(self, event: str, handler: ParticipantHandler) -> None:
        self.handlers[event] = handler


@pytest.fixture
def presence() -> tuple[LearnerPresence, FakeRoom, list[str]]:
    room = FakeRoom()
    reasons: list[str] = []

    async def request_end(reason: str) -> None:
        reasons.append(reason)

    watcher = LearnerPresence(room, request_end, grace_seconds=0.01)  # type: ignore[arg-type]
    watcher.watch()
    return watcher, room, reasons


async def test_learner_departure_ends_after_grace(presence: tuple) -> None:
    watcher, room, reasons = presence
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    await asyncio.sleep(0.05)
    assert reasons == [LEARNER_LEFT_REASON]


async def test_learner_return_within_grace_cancels_end(presence: tuple) -> None:
    watcher, room, reasons = presence
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    room.handlers["participant_connected"](FakeParticipant("learner"))
    await asyncio.sleep(0.05)
    assert reasons == []


async def test_other_participants_are_ignored(presence: tuple) -> None:
    watcher, room, reasons = presence
    room.handlers["participant_disconnected"](FakeParticipant("observer"))
    await asyncio.sleep(0.05)
    assert reasons == []
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    room.handlers["participant_connected"](FakeParticipant("observer"))
    await asyncio.sleep(0.05)
    assert reasons == [LEARNER_LEFT_REASON]


async def test_cancel_stops_departure_timer(presence: tuple) -> None:
    watcher, room, reasons = presence
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    watcher.cancel()
    await asyncio.sleep(0.05)
    assert reasons == []


@dataclass
class FakeHandle:
    error: BaseException | None = None
    interrupted: bool = False

    def exception(self) -> BaseException | None:
        return self.error

    def __await__(self) -> Generator[None, None, "FakeHandle"]:
        async def done() -> FakeHandle:
            return self

        return done().__await__()


class FakeSession:
    def __init__(self, first: FakeHandle) -> None:
        self._first = first
        self.calls: list[str] = []

    def generate_reply(self, *, instructions: str) -> FakeHandle:
        self.calls.append(instructions)
        return self._first if len(self.calls) == 1 else FakeHandle()


async def _greet(brief: Brief, first: FakeHandle) -> list[str]:
    tutor = WafelTutor(brief, tools=[])
    session = FakeSession(first)
    tutor._activity = SimpleNamespace(session=session)  # type: ignore[assignment]
    await tutor.on_enter()
    return session.calls


async def test_greeting_retries_once_when_reply_fails(brief: Brief) -> None:
    calls = await _greet(brief, FakeHandle(error=RuntimeError("did not start speaking")))
    assert calls == [GREETING_INSTRUCTION, GREETING_INSTRUCTION]


async def test_greeting_not_retried_on_success(brief: Brief) -> None:
    assert await _greet(brief, FakeHandle()) == [GREETING_INSTRUCTION]


async def test_greeting_not_retried_when_interrupted(brief: Brief) -> None:
    calls = await _greet(brief, FakeHandle(error=RuntimeError("x"), interrupted=True))
    assert calls == [GREETING_INSTRUCTION]


async def test_repeated_learner_disconnects_end_once(presence: tuple) -> None:
    watcher, room, reasons = presence
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    await asyncio.sleep(0.05)
    assert reasons == [LEARNER_LEFT_REASON]

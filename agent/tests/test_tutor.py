import asyncio
from collections.abc import Callable, Generator
from dataclasses import dataclass, field
from typing import Any

import pytest
from livekit import rtc
from livekit.agents.llm import AgentHandoff, ChatMessage
from livekit.agents.voice.events import ConversationItemAddedEvent

from wafel_agent.brief import Brief, LanguagePolicy, SessionType
from wafel_agent.prompts import build_voice_prompt
from wafel_agent.tutor import (
    CAP_FAREWELL_INSTRUCTION,
    LEARNER_LEFT_REASON,
    SCRIPT_START_INSTRUCTION,
    LearnerPresence,
    LessonLifecycle,
    TranscriptLog,
    WafelTutor,
    greet,
    greeting_instruction,
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


async def test_cap_tells_tutor_to_say_goodbye_before_shutdown(brief: Brief) -> None:
    reasons: list[str] = []
    session = FakeSession(FakeHandle())
    lc = LessonLifecycle(brief, FakeApi(), shutdown=reasons.append, end_delay=0.0, cap_seconds=0.01)  # type: ignore[arg-type]
    task = lc.mark_started(session)
    await asyncio.wait_for(task, timeout=1)
    assert session.calls == [CAP_FAREWELL_INSTRUCTION]
    assert session.awaited == [CAP_FAREWELL_INSTRUCTION]
    assert reasons == ["cap"]


async def test_cap_farewell_timeout_still_ends(brief: Brief, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setattr("wafel_agent.tutor.CAP_FAREWELL_TIMEOUT_SEC", 0.01)
    reasons: list[str] = []
    session = FakeSession(FakeHandle(delay=10.0))
    lc = LessonLifecycle(brief, FakeApi(), shutdown=reasons.append, end_delay=0.0, cap_seconds=0.0)  # type: ignore[arg-type]
    await asyncio.wait_for(lc.mark_started(session), timeout=1)
    assert session.calls == [CAP_FAREWELL_INSTRUCTION]
    assert reasons == ["cap"]


async def test_cap_farewell_error_still_ends(brief: Brief) -> None:
    reasons: list[str] = []
    session = FakeSession(FakeHandle(raises=RuntimeError("closed")))
    lc = LessonLifecycle(brief, FakeApi(), shutdown=reasons.append, end_delay=0.0, cap_seconds=0.0)  # type: ignore[arg-type]
    await asyncio.wait_for(lc.mark_started(session), timeout=1)
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
    disconnect_reason: int | None = None


ParticipantHandler = Callable[[FakeParticipant], None]


class FakeRoom:
    def __init__(self) -> None:
        self.handlers: dict[str, ParticipantHandler] = {}

    def on(self, event: str, handler: ParticipantHandler) -> None:
        self.handlers[event] = handler


def _presence(grace_seconds: float) -> tuple[LearnerPresence, FakeRoom, list[str]]:
    room = FakeRoom()
    reasons: list[str] = []

    async def request_end(reason: str) -> None:
        reasons.append(reason)

    watcher = LearnerPresence(room, request_end, grace_seconds=grace_seconds)  # type: ignore[arg-type]
    watcher.watch()
    return watcher, room, reasons


@pytest.fixture
def presence() -> tuple[LearnerPresence, FakeRoom, list[str]]:
    return _presence(0.01)


async def test_client_initiated_leave_ends_without_grace() -> None:
    watcher, room, reasons = _presence(grace_seconds=30.0)
    room.handlers["participant_disconnected"](
        FakeParticipant("learner", rtc.DisconnectReason.CLIENT_INITIATED)
    )
    await asyncio.sleep(0.05)
    assert reasons == [LEARNER_LEFT_REASON]


async def test_dropped_connection_keeps_grace() -> None:
    watcher, room, reasons = _presence(grace_seconds=30.0)
    room.handlers["participant_disconnected"](
        FakeParticipant("learner", rtc.DisconnectReason.SIGNAL_CLOSE)
    )
    await asyncio.sleep(0.05)
    assert reasons == []
    watcher.cancel()


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
    delay: float = 0.0
    raises: BaseException | None = None
    awaited: list[str] | None = None
    instructions: str = ""

    def exception(self) -> BaseException | None:
        return self.error

    def __await__(self) -> Generator[None, None, "FakeHandle"]:
        async def done() -> FakeHandle:
            await asyncio.sleep(self.delay)
            if self.raises is not None:
                raise self.raises
            if self.awaited is not None:
                self.awaited.append(self.instructions)
            return self

        return done().__await__()


class FakeSession:
    def __init__(self, first: FakeHandle) -> None:
        self._first = first
        self.calls: list[str] = []
        self.awaited: list[str] = []

    def generate_reply(self, *, instructions: str) -> FakeHandle:
        self.calls.append(instructions)
        handle = self._first if len(self.calls) == 1 else FakeHandle()
        handle.awaited = self.awaited
        handle.instructions = instructions
        return handle


async def _greet(brief: Brief, first: FakeHandle) -> list[str]:
    session = FakeSession(first)
    await greet(session, brief)
    return session.calls


async def test_greeting_then_script_start(brief: Brief) -> None:
    assert await _greet(brief, FakeHandle()) == [
        greeting_instruction(brief),
        SCRIPT_START_INSTRUCTION,
    ]


async def test_greeting_retries_once_when_reply_fails(brief: Brief) -> None:
    calls = await _greet(brief, FakeHandle(error=RuntimeError("did not start speaking")))
    hello = greeting_instruction(brief)
    assert calls == [hello, hello, SCRIPT_START_INSTRUCTION]


async def test_greeting_not_retried_when_interrupted(brief: Brief) -> None:
    calls = await _greet(brief, FakeHandle(error=RuntimeError("x"), interrupted=True))
    assert calls == [greeting_instruction(brief), SCRIPT_START_INSTRUCTION]


async def test_greeting_swallows_session_errors(brief: Brief) -> None:
    calls = await _greet(brief, FakeHandle(raises=RuntimeError("closed")))
    assert calls == [greeting_instruction(brief)]


async def test_repeated_learner_disconnects_end_once(presence: tuple) -> None:
    watcher, room, reasons = presence
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    room.handlers["participant_disconnected"](FakeParticipant("learner"))
    await asyncio.sleep(0.05)
    assert reasons == [LEARNER_LEFT_REASON]


def test_script_start_instruction_starts_step_one() -> None:
    assert "paso uno del guion" in SCRIPT_START_INSTRUCTION
    assert "show_phrase" in SCRIPT_START_INSTRUCTION


def test_greeting_is_one_sentence_without_tools(lesson: Brief) -> None:
    hello = greeting_instruction(lesson)
    assert lesson.unit is not None
    assert "en inglés" in hello
    assert lesson.unit.can_do in hello
    assert "Sin llamar herramientas" in hello
    assert "show_phrase" not in hello and "paso uno" not in hello


def test_greeting_language_follows_policy(lesson: Brief) -> None:
    target_only = lesson.model_copy(update={"language_policy": LanguagePolicy.TARGET_ONLY})
    mostly = lesson.model_copy(update={"language_policy": LanguagePolicy.MOSTLY_TARGET})
    assert "en español" in greeting_instruction(target_only)
    assert "parafraseado en español" in greeting_instruction(target_only)
    assert "en español" in greeting_instruction(mostly)


def test_greeting_fits_other_session_types(brief: Brief, lesson: Brief) -> None:
    roleplay = brief.model_copy(update={"type": SessionType.ROLEPLAY})
    assert "personaje" in greeting_instruction(roleplay)
    free_talk = lesson.model_copy(
        update={"type": SessionType.FREE_TALK, "unit": None, "topic": None}
    )
    assert "relaxed conversation" in greeting_instruction(free_talk)
    review = lesson.model_copy(update={"type": SessionType.MISTAKE_REVIEW, "unit": None})
    assert lesson.topic is not None and lesson.topic in greeting_instruction(review)

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any, Literal, Protocol

from livekit import rtc
from livekit.agents import Agent
from livekit.agents.llm import ChatMessage
from livekit.agents.llm.tool_context import FunctionTool
from livekit.agents.voice.events import ConversationItemAddedEvent

from wafel_agent.api import WafelApi
from wafel_agent.brief import Brief
from wafel_agent.prompts import build_voice_prompt

logger = logging.getLogger("wafel.tutor")

END_DELAY_SEC = 3.0
CAP_REASON = "cap"
CAP_FAREWELL_TIMEOUT_SEC = 12.0
CAP_FAREWELL_INSTRUCTION = (
    "Se acabó el tiempo de hoy. Despídete del alumno en una sola frase, en español."
)
LEARNER_IDENTITY = "learner"
LEARNER_GRACE_SEC = 20.0
LEARNER_LEFT_REASON = "learner left"
GREETING_INSTRUCTION = (
    "Saluda al alumno en español, preséntate brevemente y haz la primera pregunta."
)

TranscriptRole = Literal["tutor", "learner"]
Shutdown = Callable[[str], None]
Elapsed = Callable[[], float]
RequestEnd = Callable[[str], Awaitable[None]]

_CHAT_ROLE_TO_TRANSCRIPT: dict[str, TranscriptRole] = {"assistant": "tutor", "user": "learner"}


class ReplySession(Protocol):
    """The slice of AgentSession the lifecycle needs: ask the tutor to speak and await it."""

    def generate_reply(self, *, instructions: str) -> Awaitable[Any]: ...


def _zero() -> float:
    return 0.0


class TranscriptLog:
    def __init__(self, elapsed: Elapsed = _zero) -> None:
        self._elapsed = elapsed
        self._entries: list[dict[str, Any]] = []

    def append(self, role: TranscriptRole, text: str) -> None:
        self._entries.append({"role": role, "text": text, "t": round(self._elapsed(), 1)})

    def entries(self) -> list[dict[str, Any]]:
        return [dict(entry) for entry in self._entries]

    def on_item(self, event: ConversationItemAddedEvent) -> None:
        item = event.item
        if not isinstance(item, ChatMessage):
            return
        role = _CHAT_ROLE_TO_TRANSCRIPT.get(item.role)
        text = (item.text_content or "").strip()
        if role is not None and text:
            self.append(role, text)


class WafelTutor(Agent):
    def __init__(self, brief: Brief, tools: list[FunctionTool]) -> None:
        super().__init__(instructions=build_voice_prompt(brief), tools=list(tools))

    async def on_enter(self) -> None:
        # GPT-Live occasionally never starts the first reply (10 s timeout in livekit-agents,
        # surfaced on the handle rather than raised); give the greeting one more try.
        handle = await self.session.generate_reply(instructions=GREETING_INSTRUCTION)
        if handle.exception() is not None and not handle.interrupted:
            logger.warning("greeting did not start (%s); retrying once", handle.exception())
            self.session.generate_reply(instructions=GREETING_INSTRUCTION)


class LessonLifecycle:
    def __init__(
        self,
        brief: Brief,
        api: WafelApi,
        shutdown: Shutdown,
        *,
        end_delay: float = END_DELAY_SEC,
        cap_seconds: float | None = None,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._session_id = brief.session_id
        self._api = api
        self._shutdown = shutdown
        self._end_delay = end_delay
        self._cap_seconds = brief.cap_minutes * 60 if cap_seconds is None else cap_seconds
        self._clock = clock
        self._started_at: float | None = None
        self._session: ReplySession | None = None
        self._ending = False
        self._cap_task: asyncio.Task[None] | None = None
        self.transcript = TranscriptLog(self.elapsed)

    def elapsed(self) -> float:
        if self._started_at is None:
            return 0.0
        return self._clock() - self._started_at

    @property
    def duration_sec(self) -> int:
        return int(self.elapsed())

    def mark_started(self, session: ReplySession | None = None) -> asyncio.Task[None]:
        self._started_at = self._clock()
        self._session = session
        return self._start_cap_timer()

    async def request_end(self, reason: str) -> None:
        if self._ending:
            return
        self._ending = True
        logger.info("ending lesson %s: %s", self._session_id, reason)
        await asyncio.sleep(self._end_delay)
        self._shutdown(reason)

    async def _say_farewell(self) -> None:
        """The model cannot see the clock, so tell it time is up and let it close the lesson."""
        if self._session is None:
            return
        try:
            await asyncio.wait_for(
                self._session.generate_reply(instructions=CAP_FAREWELL_INSTRUCTION),
                timeout=CAP_FAREWELL_TIMEOUT_SEC,
            )
        except TimeoutError:
            logger.warning("cap farewell did not finish within %.0fs", CAP_FAREWELL_TIMEOUT_SEC)
        except Exception as exc:
            logger.warning("cap farewell failed: %s", exc)

    def _start_cap_timer(self) -> asyncio.Task[None]:
        async def wait_for_cap() -> None:
            await asyncio.sleep(self._cap_seconds)
            await self._say_farewell()
            await self.request_end(CAP_REASON)

        self._cap_task = asyncio.create_task(wait_for_cap(), name="wafel-cap-timer")
        return self._cap_task

    def cancel(self) -> None:
        if self._cap_task is not None and not self._cap_task.done():
            self._cap_task.cancel()

    async def post_ended(self) -> None:
        self.cancel()
        await self._api.ended(self._session_id, self.transcript.entries(), self.duration_sec)


class LearnerPresence:
    """Ends the lesson when the learner leaves and does not return within a grace period."""

    def __init__(
        self,
        room: rtc.Room,
        request_end: RequestEnd,
        *,
        identity: str = LEARNER_IDENTITY,
        grace_seconds: float = LEARNER_GRACE_SEC,
    ) -> None:
        self._room = room
        self._request_end = request_end
        self._identity = identity
        self._grace_seconds = grace_seconds
        self._grace_task: asyncio.Task[None] | None = None

    def watch(self) -> None:
        self._room.on("participant_disconnected", self.on_participant_disconnected)
        self._room.on("participant_connected", self.on_participant_connected)

    def on_participant_disconnected(self, participant: rtc.RemoteParticipant) -> None:
        if participant.identity != self._identity:
            return
        logger.info("learner left; ending in %.0fs unless they return", self._grace_seconds)
        self.cancel()
        self._grace_task = asyncio.create_task(self._end_after_grace(), name="wafel-learner-grace")

    def on_participant_connected(self, participant: rtc.RemoteParticipant) -> None:
        if participant.identity != self._identity or self._grace_task is None:
            return
        logger.info("learner returned; cancelling departure timer")
        self.cancel()

    async def _end_after_grace(self) -> None:
        await asyncio.sleep(self._grace_seconds)
        await self._request_end(LEARNER_LEFT_REASON)

    def cancel(self) -> None:
        if self._grace_task is not None:
            self._grace_task.cancel()
            self._grace_task = None

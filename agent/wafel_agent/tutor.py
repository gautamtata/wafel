from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any, Literal

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
GREETING_INSTRUCTION = (
    "Saluda al alumno en español, preséntate brevemente y haz la primera pregunta."
)

TranscriptRole = Literal["tutor", "learner"]
Shutdown = Callable[[str], None]
Elapsed = Callable[[], float]

_CHAT_ROLE_TO_TRANSCRIPT: dict[str, TranscriptRole] = {"assistant": "tutor", "user": "learner"}


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

    def mark_started(self) -> asyncio.Task[None]:
        self._started_at = self._clock()
        return self._start_cap_timer()

    async def request_end(self, reason: str) -> None:
        if self._ending:
            return
        self._ending = True
        logger.info("ending lesson %s: %s", self._session_id, reason)
        await asyncio.sleep(self._end_delay)
        self._shutdown(reason)

    def _start_cap_timer(self) -> asyncio.Task[None]:
        async def wait_for_cap() -> None:
            await asyncio.sleep(self._cap_seconds)
            await self.request_end(CAP_REASON)

        self._cap_task = asyncio.create_task(wait_for_cap(), name="wafel-cap-timer")
        return self._cap_task

    def cancel(self) -> None:
        if self._cap_task is not None and not self._cap_task.done():
            self._cap_task.cancel()

    async def post_ended(self) -> None:
        self.cancel()
        await self._api.ended(self._session_id, self.transcript.entries(), self.duration_sec)

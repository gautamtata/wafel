from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Callable
from typing import Any

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

TranscriptRole = str
Shutdown = Callable[[str], None]


class TranscriptLog:
    def __init__(self) -> None:
        self._entries: list[dict[str, Any]] = []

    def append(self, role: TranscriptRole, text: str) -> None:
        self._entries.append({"role": role, "text": text})

    def entries(self) -> list[dict[str, Any]]:
        return [dict(entry) for entry in self._entries]

    def on_item(self, event: ConversationItemAddedEvent) -> None:
        item = event.item
        if not isinstance(item, ChatMessage) or item.role not in ("user", "assistant"):
            return
        text = (item.text_content or "").strip()
        if text:
            self.append(item.role, text)


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
        self._started_at = clock()
        self._ending = False
        self._cap_task: asyncio.Task[None] | None = None
        self.transcript = TranscriptLog()

    @property
    def duration_sec(self) -> int:
        return int(self._clock() - self._started_at)

    async def request_end(self, reason: str) -> None:
        if self._ending:
            return
        self._ending = True
        logger.info("ending lesson %s: %s", self._session_id, reason)
        await asyncio.sleep(self._end_delay)
        self._shutdown(reason)

    def start_cap_timer(self) -> asyncio.Task[None]:
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

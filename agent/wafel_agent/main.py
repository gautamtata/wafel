from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import AgentSession, JobContext, JobProcess, WorkerOptions, cli
from livekit.agents.voice.room_io import RoomOptions
from livekit.plugins.openai.realtime import GPTLiveModel

from wafel_agent.api import WafelApi
from wafel_agent.brief import Brief, load_brief_file
from wafel_agent.prompts import build_backend_prompt
from wafel_agent.tools import build_tools
from wafel_agent.tutor import (
    LEARNER_IDENTITY,
    LearnerPresence,
    LessonLifecycle,
    ReplySession,
    Shutdown,
    WafelTutor,
    greet,
)

logger = logging.getLogger("wafel.main")

AGENT_NAME = "wafel-tutor"
VOICE_MODEL = "gpt-live-1"
BACKEND_MODEL = "gpt-5.6-luna"
LEARNER_JOIN_TIMEOUT_S = 240.0
LEARNER_NEVER_JOINED = "learner never joined"

LearnerWaiter = Callable[[JobContext], Awaitable[object]]
SessionStarter = Callable[[JobContext, Brief, LessonLifecycle, WafelApi], Awaitable[ReplySession]]


@dataclass(frozen=True)
class Settings:
    api_url: str
    agent_secret: str
    sample_brief: str | None

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            api_url=os.environ.get("WAFEL_API_URL", "http://localhost:3000"),
            agent_secret=os.environ.get("AGENT_SHARED_SECRET", ""),
            sample_brief=os.environ.get("WAFEL_SAMPLE_BRIEF") or None,
        )


def session_id_from_metadata(metadata: str) -> str | None:
    if not metadata:
        return None
    try:
        value = json.loads(metadata).get("sessionId")
    except (json.JSONDecodeError, AttributeError):
        logger.warning("job metadata is not a JSON object: %r", metadata)
        return None
    return str(value) if value else None


async def resolve_brief(
    api: WafelApi, session_id: str | None, settings: Settings, shutdown: Shutdown
) -> Brief | None:
    if session_id is None:
        if settings.sample_brief is None:
            logger.error("no sessionId in job metadata and WAFEL_SAMPLE_BRIEF is unset")
            shutdown("no session")
            return None
        logger.info("no sessionId in job metadata; using sample brief %s", settings.sample_brief)
        return load_brief_file(settings.sample_brief)
    try:
        return await api.get_brief(session_id)
    except Exception as exc:
        logger.warning("brief fetch failed for session %s: %s", session_id, exc)
        await api.failed(session_id, f"brief fetch failed: {exc}")
        shutdown("brief fetch failed")
        return None


def room_options() -> RoomOptions:
    """Link only the learner; keep the session open across a page refresh so they can rejoin."""
    return RoomOptions(participant_identity=LEARNER_IDENTITY, close_on_disconnect=False)


def build_llm(brief: Brief) -> GPTLiveModel:
    return GPTLiveModel(
        model=VOICE_MODEL,
        voice=brief.voice,
        delegation="responses",
        responses_options={"model": BACKEND_MODEL, "instructions": build_backend_prompt(brief)},
    )


def build_shutdown(
    presence: LearnerPresence, lifecycle: LessonLifecycle, api: WafelApi
) -> Callable[[], Awaitable[None]]:
    async def on_shutdown() -> None:
        presence.cancel()
        await lifecycle.post_ended()
        await api.aclose()

    return on_shutdown


async def wait_for_learner(ctx: JobContext) -> rtc.RemoteParticipant:
    return await ctx.wait_for_participant(identity=LEARNER_IDENTITY)


async def start_session(
    ctx: JobContext, brief: Brief, lifecycle: LessonLifecycle, api: WafelApi
) -> ReplySession:
    tools = build_tools(brief.session_id, api, ctx.room, lifecycle.request_end)
    session = AgentSession(llm=build_llm(brief))
    session.on("conversation_item_added", lifecycle.transcript.on_item)
    await session.start(WafelTutor(brief, tools), room=ctx.room, room_options=room_options())
    return session


async def run_lesson(
    ctx: JobContext,
    brief: Brief,
    api: WafelApi,
    *,
    wait: LearnerWaiter = wait_for_learner,
    start: SessionStarter = start_session,
    join_timeout: float = LEARNER_JOIN_TIMEOUT_S,
) -> None:
    """Create the GPT-Live session first so the model is connected by the time the learner joins.

    RoomIO links the learner in the background and holds audio until their track is up, so
    starting early is safe. Nothing that bills or marks the session ACTIVE happens before the
    learner joins, and the shutdown callback (which posts `ended`) is registered only after the
    wait succeeds; a join timeout closes the session and posts `failed` instead.
    """
    lifecycle = LessonLifecycle(brief, api, ctx.shutdown)
    session = await start(ctx, brief, lifecycle, api)
    try:
        await asyncio.wait_for(wait(ctx), join_timeout)
    except TimeoutError:
        logger.warning("learner did not join within %.0fs; giving up", join_timeout)
        await session.aclose()
        await api.failed(brief.session_id, LEARNER_NEVER_JOINED)
        await api.aclose()
        ctx.shutdown(LEARNER_NEVER_JOINED)
        return

    logger.info("learner joined; greeting")
    presence = LearnerPresence(ctx.room, lifecycle.request_end)
    ctx.add_shutdown_callback(build_shutdown(presence, lifecycle, api))
    presence.watch()
    greeting = asyncio.create_task(greet(session, brief), name="wafel-greeting")
    lifecycle.mark_started(session)
    await api.started(brief.session_id)
    await greeting


async def entrypoint(ctx: JobContext) -> None:
    settings = Settings.from_env()
    api = WafelApi(settings.api_url, settings.agent_secret)
    session_id = session_id_from_metadata(ctx.job.metadata)
    ctx.log_context_fields = {"session_id": session_id or "sample"}

    await ctx.connect()
    brief = await resolve_brief(api, session_id, settings, ctx.shutdown)
    if brief is None:
        await api.aclose()
        return
    await run_lesson(ctx, brief, api)


def agent_name() -> str:
    return os.environ.get("WAFEL_AGENT_NAME") or AGENT_NAME


def prewarm(proc: JobProcess) -> None:
    """Import the OpenAI plugin in the warmed process so the first job starts faster."""
    import livekit.plugins.openai  # noqa: F401


def main() -> None:
    load_dotenv()
    cli.run_app(
        WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm, agent_name=agent_name())
    )


if __name__ == "__main__":
    main()

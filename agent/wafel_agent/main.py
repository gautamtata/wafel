from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

from dotenv import load_dotenv
from livekit.agents import AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins.openai.realtime import GPTLiveModel

from wafel_agent.api import WafelApi
from wafel_agent.brief import Brief, load_brief_file
from wafel_agent.prompts import build_backend_prompt
from wafel_agent.tools import build_tools
from wafel_agent.tutor import LessonLifecycle, WafelTutor

logger = logging.getLogger("wafel.main")

AGENT_NAME = "wafel-tutor"
VOICE_MODEL = "gpt-live-1"
BACKEND_MODEL = "gpt-5.6-luna"


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


async def resolve_brief(api: WafelApi, session_id: str | None, settings: Settings) -> Brief | None:
    if session_id is not None:
        try:
            return await api.get_brief(session_id)
        except Exception as exc:
            logger.warning("brief fetch failed for session %s: %s", session_id, exc)
            if settings.sample_brief is None:
                await api.failed(session_id, f"brief fetch failed: {exc}")
                return None
    if settings.sample_brief is None:
        logger.error("no sessionId in job metadata and WAFEL_SAMPLE_BRIEF is unset")
        return None
    logger.info("using sample brief %s", settings.sample_brief)
    return load_brief_file(settings.sample_brief)


def build_llm(brief: Brief) -> GPTLiveModel:
    return GPTLiveModel(
        model=VOICE_MODEL,
        voice=brief.voice,
        delegation="responses",
        responses_options={"model": BACKEND_MODEL, "instructions": build_backend_prompt(brief)},
    )


async def entrypoint(ctx: JobContext) -> None:
    settings = Settings.from_env()
    api = WafelApi(settings.api_url, settings.agent_secret)
    session_id = session_id_from_metadata(ctx.job.metadata)
    ctx.log_context_fields = {"session_id": session_id or "sample"}

    await ctx.connect()
    brief = await resolve_brief(api, session_id, settings)
    if brief is None:
        await api.aclose()
        return

    lifecycle = LessonLifecycle(brief, api, ctx.shutdown)
    tools = build_tools(brief.session_id, api, ctx.room, lifecycle.request_end)
    session = AgentSession(llm=build_llm(brief))
    session.on("conversation_item_added", lifecycle.transcript.on_item)

    async def on_shutdown() -> None:
        await lifecycle.post_ended()
        await api.aclose()

    ctx.add_shutdown_callback(on_shutdown)

    await session.start(WafelTutor(brief, tools), room=ctx.room)
    lifecycle.start_cap_timer()
    await api.started(brief.session_id)


def main() -> None:
    load_dotenv()
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))


if __name__ == "__main__":
    main()

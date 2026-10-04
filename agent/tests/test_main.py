import asyncio
import json
from collections.abc import Generator
from pathlib import Path

import httpx
import pytest
import respx

from wafel_agent.api import WafelApi
from wafel_agent.brief import Brief
from wafel_agent.main import (
    AGENT_NAME,
    BACKEND_MODEL,
    LEARNER_JOIN_TIMEOUT_S,
    LEARNER_NEVER_JOINED,
    VOICE_MODEL,
    Settings,
    agent_name,
    build_llm,
    build_shutdown,
    resolve_brief,
    room_options,
    run_lesson,
    session_id_from_metadata,
)
from wafel_agent.tutor import (
    LEARNER_IDENTITY,
    SCRIPT_START_INSTRUCTION,
    LearnerPresence,
    LessonLifecycle,
    greeting_instruction,
)

BASE = "http://wafel.test"


def test_agent_name(monkeypatch: pytest.MonkeyPatch) -> None:
    assert AGENT_NAME == "wafel-tutor"
    monkeypatch.delenv("WAFEL_AGENT_NAME", raising=False)
    assert agent_name() == "wafel-tutor"
    monkeypatch.setenv("WAFEL_AGENT_NAME", "wafel-tutor-dev")
    assert agent_name() == "wafel-tutor-dev"


def test_session_id_from_metadata() -> None:
    assert session_id_from_metadata('{"sessionId":"abc"}') == "abc"
    assert session_id_from_metadata("") is None
    assert session_id_from_metadata("{}") is None
    assert session_id_from_metadata("not json") is None
    assert session_id_from_metadata("[1]") is None


def test_settings_from_env(monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setenv("WAFEL_API_URL", "http://x")
    monkeypatch.setenv("AGENT_SHARED_SECRET", "s")
    monkeypatch.setenv("WAFEL_SAMPLE_BRIEF", "")
    assert Settings.from_env() == Settings("http://x", "s", None)


@respx.mock
async def test_resolve_brief_from_api(sample_json: dict) -> None:
    respx.get(f"{BASE}/api/agent/sessions/abc/brief").respond(200, json=sample_json)
    reasons: list[str] = []
    brief = await resolve_brief(
        WafelApi(BASE, "s"), "abc", Settings(BASE, "s", None), reasons.append
    )
    assert brief is not None and brief.session_id == "sample-session"
    assert reasons == []


@respx.mock
async def test_resolve_brief_failure_posts_failed_and_shuts_down(tmp_path: Path) -> None:
    respx.get(f"{BASE}/api/agent/sessions/abc/brief").respond(500)
    failed = respx.post(f"{BASE}/api/agent/sessions/abc/failed").respond(204)
    reasons: list[str] = []
    settings = Settings(BASE, "s", str(tmp_path / "unused.json"))
    brief = await resolve_brief(WafelApi(BASE, "s"), "abc", settings, reasons.append)
    assert brief is None
    assert "brief fetch failed" in json.loads(failed.calls.last.request.content)["reason"]
    assert reasons == ["brief fetch failed"]


@respx.mock
async def test_resolve_brief_connect_error_posts_failed_and_shuts_down() -> None:
    respx.get(f"{BASE}/api/agent/sessions/abc/brief").mock(side_effect=httpx.ConnectError("x"))
    failed = respx.post(f"{BASE}/api/agent/sessions/abc/failed").respond(204)
    reasons: list[str] = []
    brief = await resolve_brief(
        WafelApi(BASE, "s"), "abc", Settings(BASE, "s", None), reasons.append
    )
    assert brief is None
    assert failed.called
    assert reasons == ["brief fetch failed"]


async def test_resolve_brief_uses_sample_only_without_session_id(
    tmp_path: Path, sample_json: dict
) -> None:
    path = tmp_path / "b.json"
    path.write_text(json.dumps(sample_json))
    reasons: list[str] = []
    brief = await resolve_brief(
        WafelApi(BASE, "s"), None, Settings(BASE, "s", str(path)), reasons.append
    )
    assert brief is not None and brief.session_id == "sample-session"
    assert reasons == []


async def test_resolve_brief_shuts_down_without_session_or_sample() -> None:
    reasons: list[str] = []
    brief = await resolve_brief(
        WafelApi(BASE, "s"), None, Settings(BASE, "s", None), reasons.append
    )
    assert brief is None
    assert reasons == ["no session"]


def test_build_llm_configuration(brief: Brief, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    llm = build_llm(brief)
    assert llm.model == VOICE_MODEL
    opts = llm._opts
    assert opts.voice == brief.voice
    assert opts.delegation == "responses"
    assert opts.responses["model"] == BACKEND_MODEL
    assert "end_lesson" in opts.responses["instructions"]


def test_room_options_link_learner_and_survive_refresh() -> None:
    opts = room_options()
    assert LEARNER_IDENTITY == "learner"
    assert opts.participant_identity == LEARNER_IDENTITY
    assert opts.close_on_disconnect is False


class _Room:
    def on(self, event: str, handler: object) -> None:
        pass


@respx.mock
async def test_shutdown_cancels_grace_timer_then_posts_ended(brief: Brief) -> None:
    ended = respx.post(f"{BASE}/api/agent/sessions/sample-session/ended").respond(204)
    api = WafelApi(BASE, "s")
    reasons: list[str] = []
    lifecycle = LessonLifecycle(brief, api, reasons.append, end_delay=0.0)
    presence = LearnerPresence(_Room(), lifecycle.request_end, grace_seconds=0.01)  # type: ignore[arg-type]
    learner = type("P", (), {"identity": "learner", "disconnect_reason": None})()
    presence.on_participant_disconnected(learner)  # type: ignore[arg-type]
    await build_shutdown(presence, lifecycle, api)()
    await asyncio.sleep(0.05)
    assert reasons == []
    assert ended.called


class _Ctx:
    def __init__(self) -> None:
        self.room = _Room()
        self.reasons: list[str] = []
        self.shutdown_callbacks: list[object] = []

    def shutdown(self, reason: str = "") -> None:
        self.reasons.append(reason)

    def add_shutdown_callback(self, callback: object) -> None:
        self.shutdown_callbacks.append(callback)


class _Handle:
    interrupted = False

    def exception(self) -> BaseException | None:
        return None

    def __await__(self) -> Generator[None, None, "_Handle"]:
        async def done() -> _Handle:
            return self

        return done().__await__()


class _Session:
    def __init__(self, calls: list[str] | None = None) -> None:
        self.calls = calls if calls is not None else []
        self.closed = False

    def generate_reply(self, *, instructions: str) -> _Handle:
        self.calls.append(instructions)
        return _Handle()

    async def aclose(self) -> None:
        self.closed = True


def test_join_timeout_is_four_minutes() -> None:
    assert LEARNER_JOIN_TIMEOUT_S == 240.0


@respx.mock
async def test_run_lesson_connects_model_before_join_and_bills_after(brief: Brief) -> None:
    started = respx.post(f"{BASE}/api/agent/sessions/sample-session/started").respond(204)
    failed = respx.post(f"{BASE}/api/agent/sessions/sample-session/failed").respond(204)
    ctx = _Ctx()
    order: list[str] = []
    session = _Session(order)

    async def wait(_ctx: object) -> object:
        await asyncio.sleep(0.01)
        order.append("joined")
        return object()

    async def start(*_args: object) -> _Session:
        order.append("start")
        assert not started.called
        return session

    await run_lesson(ctx, brief, WafelApi(BASE, "s"), wait=wait, start=start)  # type: ignore[arg-type]
    assert order == ["start", "joined", greeting_instruction(brief), SCRIPT_START_INSTRUCTION]
    assert started.called and not failed.called
    assert ctx.reasons == []
    assert len(ctx.shutdown_callbacks) == 1
    assert not session.closed


@respx.mock
async def test_run_lesson_fails_when_learner_never_joins(brief: Brief) -> None:
    started = respx.post(f"{BASE}/api/agent/sessions/sample-session/started").respond(204)
    failed = respx.post(f"{BASE}/api/agent/sessions/sample-session/failed").respond(204)
    ended = respx.post(f"{BASE}/api/agent/sessions/sample-session/ended").respond(204)
    ctx = _Ctx()
    session = _Session()

    async def wait(_ctx: object) -> object:
        await asyncio.sleep(10)
        return object()

    async def start(*_args: object) -> _Session:
        return session

    await run_lesson(ctx, brief, WafelApi(BASE, "s"), wait=wait, start=start, join_timeout=0.01)  # type: ignore[arg-type]
    assert session.closed
    assert session.calls == []
    assert not started.called and not ended.called
    assert json.loads(failed.calls.last.request.content) == {"reason": LEARNER_NEVER_JOINED}
    assert ctx.reasons == [LEARNER_NEVER_JOINED]
    assert ctx.shutdown_callbacks == []

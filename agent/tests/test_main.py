import json
from pathlib import Path

import httpx
import respx

from wafel_agent.api import WafelApi
from wafel_agent.brief import Brief
from wafel_agent.main import (
    AGENT_NAME,
    BACKEND_MODEL,
    VOICE_MODEL,
    Settings,
    build_llm,
    resolve_brief,
    session_id_from_metadata,
)

BASE = "http://wafel.test"


def test_agent_name() -> None:
    assert AGENT_NAME == "wafel-tutor"


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

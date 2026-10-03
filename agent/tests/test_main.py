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
    brief = await resolve_brief(WafelApi(BASE, "s"), "abc", Settings(BASE, "s", None))
    assert brief is not None and brief.session_id == "sample-session"


@respx.mock
async def test_resolve_brief_posts_failed_without_sample() -> None:
    respx.get(f"{BASE}/api/agent/sessions/abc/brief").respond(500)
    failed = respx.post(f"{BASE}/api/agent/sessions/abc/failed").respond(204)
    brief = await resolve_brief(WafelApi(BASE, "s"), "abc", Settings(BASE, "s", None))
    assert brief is None
    assert "brief fetch failed" in json.loads(failed.calls.last.request.content)["reason"]


@respx.mock
async def test_resolve_brief_falls_back_to_sample(tmp_path: Path, sample_json: dict) -> None:
    respx.get(f"{BASE}/api/agent/sessions/abc/brief").mock(side_effect=httpx.ConnectError("x"))
    path = tmp_path / "b.json"
    path.write_text(json.dumps(sample_json))
    brief = await resolve_brief(WafelApi(BASE, "s"), "abc", Settings(BASE, "s", str(path)))
    assert brief is not None and brief.session_id == "sample-session"


async def test_resolve_brief_none_without_session_or_sample() -> None:
    assert await resolve_brief(WafelApi(BASE, "s"), None, Settings(BASE, "s", None)) is None


def test_build_llm_configuration(brief: Brief, monkeypatch) -> None:  # noqa: ANN001
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    llm = build_llm(brief)
    assert llm.model == VOICE_MODEL
    opts = llm._opts
    assert opts.voice == brief.voice
    assert opts.delegation == "responses"
    assert opts.responses["model"] == BACKEND_MODEL
    assert "end_lesson" in opts.responses["instructions"]

import httpx
import pytest
import respx

from wafel_agent.api import WafelApi
from wafel_agent.brief import Brief, MistakeCategory

BASE = "http://wafel.test"
SECRET = "s3cret"


@pytest.fixture
def api() -> WafelApi:
    return WafelApi(BASE, SECRET)


@respx.mock
async def test_get_brief_parses_and_sends_secret(api: WafelApi, sample_json: dict) -> None:
    route = respx.get(f"{BASE}/api/agent/sessions/abc/brief").respond(200, json=sample_json)
    brief = await api.get_brief("abc")
    assert isinstance(brief, Brief)
    assert brief.session_id == "sample-session"
    assert route.calls.last.request.headers["X-Agent-Secret"] == SECRET


@respx.mock
async def test_get_brief_raises_on_error(api: WafelApi) -> None:
    respx.get(f"{BASE}/api/agent/sessions/abc/brief").respond(404)
    with pytest.raises(httpx.HTTPStatusError):
        await api.get_brief("abc")


@respx.mock
async def test_started_posts_empty_body(api: WafelApi) -> None:
    route = respx.post(f"{BASE}/api/agent/sessions/abc/started").respond(204)
    await api.started("abc")
    assert route.called
    assert route.calls.last.request.content == b"{}"


@respx.mock
async def test_save_vocab_success(api: WafelApi) -> None:
    route = respx.post(f"{BASE}/api/agent/sessions/abc/vocab").respond(200, json={"ok": True})
    assert await api.save_vocab("abc", "la cuenta", "the bill", "¿Me trae la cuenta?") is True
    body = route.calls.last.request.read()
    assert b'"example":"\\u00bfMe trae la cuenta?"' in body or b"la cuenta" in body


@respx.mock
async def test_save_vocab_omits_example_when_none(api: WafelApi) -> None:
    route = respx.post(f"{BASE}/api/agent/sessions/abc/vocab").respond(200, json={"ok": True})
    await api.save_vocab("abc", "hola", "hello")
    import json

    assert json.loads(route.calls.last.request.content) == {"word": "hola", "translation": "hello"}


@respx.mock
async def test_save_vocab_returns_false_on_500(api: WafelApi) -> None:
    respx.post(f"{BASE}/api/agent/sessions/abc/vocab").respond(500)
    assert await api.save_vocab("abc", "hola", "hello") is False


@respx.mock
async def test_save_vocab_returns_false_on_timeout(api: WafelApi) -> None:
    respx.post(f"{BASE}/api/agent/sessions/abc/vocab").mock(side_effect=httpx.ReadTimeout("slow"))
    assert await api.save_vocab("abc", "hola", "hello") is False


@respx.mock
async def test_log_mistake_posts_body(api: WafelApi) -> None:
    import json

    route = respx.post(f"{BASE}/api/agent/sessions/abc/mistakes").respond(200, json={"ok": True})
    ok = await api.log_mistake(
        "abc", "yo come", "yo como", "first person", MistakeCategory.CONJUGATION
    )
    assert ok is True
    assert json.loads(route.calls.last.request.content) == {
        "original": "yo come",
        "corrected": "yo como",
        "explanation": "first person",
        "category": "CONJUGATION",
    }


@respx.mock
async def test_log_mistake_never_raises(api: WafelApi) -> None:
    respx.post(f"{BASE}/api/agent/sessions/abc/mistakes").mock(
        side_effect=httpx.ConnectError("down")
    )
    assert await api.log_mistake("abc", "a", "b", "c", MistakeCategory.OTHER) is False


@respx.mock
async def test_ended_posts_transcript_and_duration(api: WafelApi) -> None:
    import json

    route = respx.post(f"{BASE}/api/agent/sessions/abc/ended").respond(204)
    transcript = [{"role": "assistant", "text": "Hola"}, {"role": "user", "text": "Hola"}]
    await api.ended("abc", transcript, 42)
    assert json.loads(route.calls.last.request.content) == {
        "transcript": transcript,
        "durationSec": 42,
    }


@respx.mock
async def test_ended_swallows_errors(api: WafelApi) -> None:
    respx.post(f"{BASE}/api/agent/sessions/abc/ended").mock(side_effect=httpx.ConnectError("x"))
    await api.ended("abc", [], 1)


@respx.mock
async def test_failed_posts_reason(api: WafelApi) -> None:
    import json

    route = respx.post(f"{BASE}/api/agent/sessions/abc/failed").respond(204)
    await api.failed("abc", "brief fetch failed")
    assert json.loads(route.calls.last.request.content) == {"reason": "brief fetch failed"}


async def test_accepts_injected_client() -> None:
    async with httpx.AsyncClient() as client:
        api = WafelApi(BASE, SECRET, client=client)
        assert api.client is client

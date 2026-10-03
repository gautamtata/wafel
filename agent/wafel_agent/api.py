from __future__ import annotations

import logging
from typing import Any

import httpx

from wafel_agent.brief import Brief, MistakeCategory, TargetKind

logger = logging.getLogger("wafel.api")

DEFAULT_TIMEOUT_SEC = 5.0
ENDED_TIMEOUT_SEC = 15.0


class WafelApi:
    def __init__(self, base_url: str, secret: str, client: httpx.AsyncClient | None = None) -> None:
        self._base_url = base_url.rstrip("/")
        self._secret = secret
        self._client = client or httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_SEC)

    @property
    def client(self) -> httpx.AsyncClient:
        return self._client

    async def aclose(self) -> None:
        await self._client.aclose()

    def _url(self, session_id: str, path: str) -> str:
        return f"{self._base_url}/api/agent/sessions/{session_id}/{path}"

    async def _post(
        self,
        session_id: str,
        path: str,
        body: dict[str, Any],
        timeout: float = DEFAULT_TIMEOUT_SEC,
    ) -> httpx.Response:
        response = await self._client.post(
            self._url(session_id, path),
            json=body,
            headers={"X-Agent-Secret": self._secret},
            timeout=timeout,
        )
        response.raise_for_status()
        return response

    async def _post_quietly(
        self,
        session_id: str,
        path: str,
        body: dict[str, Any],
        timeout: float = DEFAULT_TIMEOUT_SEC,
    ) -> bool:
        try:
            await self._post(session_id, path, body, timeout)
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("POST %s failed for session %s: %s", path, session_id, exc)
            return False
        return True

    async def get_brief(self, session_id: str) -> Brief:
        response = await self._client.get(
            self._url(session_id, "brief"), headers={"X-Agent-Secret": self._secret}
        )
        response.raise_for_status()
        return Brief.model_validate(response.json())

    async def started(self, session_id: str) -> None:
        await self._post_quietly(session_id, "started", {})

    async def save_vocab(
        self, session_id: str, word: str, translation: str, example: str | None = None
    ) -> bool:
        body: dict[str, Any] = {"word": word, "translation": translation}
        if example is not None:
            body["example"] = example
        return await self._post_quietly(session_id, "vocab", body)

    async def log_mistake(
        self,
        session_id: str,
        original: str,
        corrected: str,
        explanation: str,
        category: MistakeCategory,
    ) -> bool:
        body = {
            "original": original,
            "corrected": corrected,
            "explanation": explanation,
            "category": MistakeCategory(category).value,
        }
        return await self._post_quietly(session_id, "mistakes", body)

    async def rate_attempt(
        self,
        session_id: str,
        target: str,
        kind: TargetKind,
        score: int,
        note: str | None = None,
    ) -> bool:
        body: dict[str, Any] = {"target": target, "kind": TargetKind(kind).value, "score": score}
        if note:
            body["note"] = note
        return await self._post_quietly(session_id, "ratings", body)

    async def ended(
        self, session_id: str, transcript: list[dict[str, Any]], duration_sec: int
    ) -> None:
        await self._post_quietly(
            session_id,
            "ended",
            {"transcript": transcript, "durationSec": duration_sec},
            timeout=ENDED_TIMEOUT_SEC,
        )

    async def failed(self, session_id: str, reason: str) -> None:
        await self._post_quietly(session_id, "failed", {"reason": reason})

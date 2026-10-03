"""Dev-only voice audition: one WAV per GPT-Live voice, saying the same Mexican-Spanish sentence.

Drives ``GPTLiveModel`` directly over its websocket (no LiveKit room, no worker), so it only
needs ``OPENAI_API_KEY`` from ``agent/.env``. Not deployed.

    cd agent && uv run python scripts/audition.py [--out DIR] [--voices marin cedar ...]

Writes ``<out>/<voice>.wav`` (24 kHz mono PCM16) plus ``<out>/README.txt`` with the sentence,
the transcript heard for each voice, and which voice ids the API rejected.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import llm
from livekit.agents.types import APIConnectOptions
from livekit.plugins.openai.realtime import GPTLiveModel, GPTLiveSession
from livekit.plugins.openai.realtime.gpt_live_model import NUM_CHANNELS, SAMPLE_RATE

from wafel_agent.brief import Dialect
from wafel_agent.main import BACKEND_MODEL, VOICE_MODEL
from wafel_agent.prompts import _DIALECT_BLOCKS, _IDENTITY, _OPERATOR_PREAMBLE

logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("wafel.audition")

SENTENCE = (
    "Hola, soy Wafel. ¿Qué vas a pedir hoy en la taquería? "
    "Yo quiero dos tacos al pastor y un agua de horchata, ¿y tú?"
)
# hand copy of web/src/lib/prompts-meta.ts VOICES (keep in sync) plus the plugin's GPTLiveVoices;
# the API decides, and rejected ids are reported, not fatal
CANDIDATE_VOICES = [
    "marin", "cedar", "alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse",
    "aster", "beacon", "cinder", "stone", "vesper",
    "quartz", "ripple", "willow", "gleam", "meridian", "bossa", "tempo", "delta",
]  # fmt: skip
DEFAULT_OUT = Path.home() / "Documents" / "wafel-audition"

MAX_CLIP_S = 15.0
SPEECH_START_TIMEOUT_S = 30.0
TRAILING_SILENCE_S = 1.5
PRE_ROLL_S = 0.2
# normalized int16 RMS; the plugin measured silence at ~0.0006 and speech an order above
SPEECH_RMS = 0.003
INPUT_FRAME_S = 0.1


def voice_prompt() -> str:
    return "\n\n".join(
        [
            _OPERATOR_PREAMBLE,
            _IDENTITY,
            _DIALECT_BLOCKS[Dialect.MX],
            "Esta es una prueba de voz. Cuando se te pida, di exactamente esta frase, sin "
            f"añadir, quitar ni cambiar nada, y luego guarda silencio: «{SENTENCE}»",
        ]
    )


BACKEND_PROMPT = "Voice audition. Never delegate; the voice model answers on its own."


@dataclass
class Result:
    voice: str
    status: str
    duration_s: float = 0.0
    transcript: str = ""
    error: str = ""
    path: Path | None = None


@dataclass
class _Capture:
    chunks: list[bytes] = field(default_factory=list)
    pre_roll: list[bytes] = field(default_factory=list)
    speaking: bool = False
    captured_s: float = 0.0
    quiet_s: float = 0.0
    transcript: str = ""
    error: str = ""
    started: asyncio.Event = field(default_factory=asyncio.Event)

    def push(self, frame: rtc.AudioFrame) -> bool:
        """Keep the frame once speech has begun; True when the clip is complete."""
        pcm = np.frombuffer(frame.data, dtype=np.int16).astype(np.float32) / 32768.0
        rms = float(np.sqrt(np.mean(pcm * pcm))) if pcm.size else 0.0
        if rms >= SPEECH_RMS:
            if not self.speaking:
                self.chunks.extend(self.pre_roll)
            self.speaking = True
            self.quiet_s = 0.0
        elif self.speaking:
            self.quiet_s += frame.duration
        if not self.speaking:
            # the onset's first consonant sits just before the gate opens
            keep = int(PRE_ROLL_S / frame.duration)
            self.pre_roll = (self.pre_roll + [bytes(frame.data)])[-keep:]
            return False
        self.chunks.append(bytes(frame.data))
        self.captured_s += frame.duration
        return self.quiet_s >= TRAILING_SILENCE_S or self.captured_s >= MAX_CLIP_S

    def trimmed(self) -> bytes:
        keep = max(0, len(self.chunks) - int(round((TRAILING_SILENCE_S - 0.4) / INPUT_FRAME_S)))
        return b"".join(self.chunks[:keep] if self.quiet_s >= TRAILING_SILENCE_S else self.chunks)


def _wire(session: GPTLiveSession, cap: _Capture) -> None:
    def on_server_event(event: dict[str, Any]) -> None:
        if event.get("type") == "session.started":
            cap.started.set()
        elif event.get("type") == "error":
            body = event.get("error") or {}
            code = body.get("code") or body.get("type")
            cap.error = cap.error or f"{code}: {body.get('message')}"
            cap.started.set()

    def on_error(ev: llm.RealtimeModelError) -> None:
        if not ev.recoverable:
            cap.error = cap.error or str(ev.error)
            cap.started.set()

    def on_transcript(delta: llm.DuplexOutputTranscriptDelta) -> None:
        cap.transcript += delta.text

    session.on("openai_server_event_received", on_server_event)
    session.on("error", on_error)
    session.on("transcript_delta", on_transcript)


async def _feed_silence(session: GPTLiveSession) -> None:
    """GPT-Live is full duplex; a steady input stream keeps its clock running."""
    samples = int(SAMPLE_RATE * INPUT_FRAME_S)
    silence = bytes(samples * NUM_CHANNELS * 2)
    while True:
        session.push_audio(
            rtc.AudioFrame(
                data=silence,
                sample_rate=SAMPLE_RATE,
                num_channels=NUM_CHANNELS,
                samples_per_channel=samples,
            )
        )
        await asyncio.sleep(INPUT_FRAME_S)


async def _record(session: GPTLiveSession, cap: _Capture) -> None:
    stream = session.audio_stream.__aiter__()
    deadline = time.monotonic() + SPEECH_START_TIMEOUT_S
    while not cap.error:
        if not cap.speaking and time.monotonic() >= deadline:
            return
        try:
            duplex_frame = await asyncio.wait_for(anext(stream), 1.0)
        except TimeoutError:
            continue
        except StopAsyncIteration:
            return
        if cap.push(duplex_frame.frame):
            return


async def audition(voice: str, out_dir: Path) -> Result:
    model = GPTLiveModel(
        model=VOICE_MODEL,
        voice=voice,
        delegation="responses",
        responses_options={"model": BACKEND_MODEL, "instructions": BACKEND_PROMPT},
        conn_options=APIConnectOptions(max_retry=0),
    )
    session = model.session()
    cap = _Capture()
    _wire(session, cap)
    feeder: asyncio.Task[None] | None = None
    try:
        # the framework's own hooks: whole config first, then the ask once the session is up
        await session._update_session(
            instructions=voice_prompt(), chat_ctx=llm.ChatContext.empty(), tools=[]
        )
        await asyncio.wait_for(cap.started.wait(), SPEECH_START_TIMEOUT_S)
        if cap.error:
            return Result(voice, "rejected", error=cap.error)
        feeder = asyncio.create_task(_feed_silence(session))
        session._generate_reply(instructions=f"Di ahora la frase de la prueba: «{SENTENCE}»")
        await _record(session, cap)
    except TimeoutError:
        return Result(voice, "no session", error="session.started never arrived")
    finally:
        if feeder:
            feeder.cancel()
        await session.aclose()
        await model.aclose()

    if cap.error and not cap.chunks:
        return Result(voice, "rejected", error=cap.error)
    pcm = cap.trimmed()
    if not pcm:
        return Result(voice, "no audio", transcript=cap.transcript, error=cap.error)
    path = out_dir / f"{voice}.wav"
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(NUM_CHANNELS)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm)
    duration = len(pcm) / (2 * NUM_CHANNELS * SAMPLE_RATE)
    return Result(voice, "ok", duration, cap.transcript.strip(), cap.error, path)


def write_readme(out_dir: Path, results: list[Result]) -> Path:
    lines = [
        f"Wafel voice audition (GPT-Live, model {VOICE_MODEL})",
        "",
        "Each WAV is one voice saying the same sentence under the Mexican-Spanish tutor prompt:",
        f"  {SENTENCE}",
        "",
        "Pick the one that sounds most Mexican and set it as Learner.voice in Settings.",
        "",
        "Voices:",
    ]
    for r in results:
        if r.status == "ok":
            lines.append(f"  {r.voice:<10} {r.path.name if r.path else ''}  {r.duration_s:.1f}s")
            if r.transcript:
                lines.append(f"             heard: {r.transcript}")
        else:
            lines.append(f"  {r.voice:<10} {r.status}: {r.error}")
    path = out_dir / "README.txt"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


async def run(voices: list[str], out_dir: Path, parallel: int) -> list[Result]:
    out_dir.mkdir(parents=True, exist_ok=True)
    gate = asyncio.Semaphore(parallel)

    async def one(voice: str) -> Result:
        async with gate:
            try:
                result = await audition(voice, out_dir)
            except Exception as exc:  # one bad voice must not sink the batch
                result = Result(voice, "failed", error=f"{type(exc).__name__}: {exc}")
            print(f"{result.voice:<10} {result.status:<9} {result.duration_s:4.1f}s {result.error}")
            return result

    return await asyncio.gather(*(one(v) for v in voices))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--voices", nargs="+", default=CANDIDATE_VOICES)
    parser.add_argument("--parallel", type=int, default=3)
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    results = asyncio.run(run(args.voices, args.out, args.parallel))
    readme = write_readme(args.out, results)
    ok = [r.voice for r in results if r.status == "ok"]
    bad = [r.voice for r in results if r.status != "ok"]
    print(f"\n{len(ok)} voices written to {args.out} ({readme.name} lists them)")
    if bad:
        print(f"not produced: {', '.join(bad)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

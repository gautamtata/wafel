import json
from pathlib import Path

import pytest

from wafel_agent.brief import Brief, SessionType

AGENT_DIR = Path(__file__).resolve().parent.parent
SAMPLE_PATH = AGENT_DIR / "sample_brief.json"
UNITS_DIR = AGENT_DIR.parent / "web" / "content" / "units" / "es-MX"


def load_units(level: str) -> list[dict]:
    return json.loads((UNITS_DIR / f"{level}.json").read_text())


def load_all_units() -> list[dict]:
    return [u for path in sorted(UNITS_DIR.glob("*.json")) for u in json.loads(path.read_text())]


def brief_unit(unit: dict, word_scores: dict | None = None) -> dict:
    keys = ("id", "title", "canDo", "pattern", "targetWords", "modelSentences", "scenarioHint")
    return {k: unit[k] for k in keys if k in unit} | {"wordScores": word_scores or {}}


@pytest.fixture
def sample_json() -> dict:
    return json.loads(SAMPLE_PATH.read_text())


@pytest.fixture
def brief(sample_json: dict) -> Brief:
    return Brief.model_validate(sample_json)


@pytest.fixture
def unit_json() -> dict:
    scores = {
        "hola": {"best": 3, "sessions": ["s1", "s2"]},
        "me llamo": {"best": 1, "sessions": ["s1"]},
    }
    return brief_unit(load_units("A1")[0], scores)


@pytest.fixture
def lesson_json(sample_json: dict, unit_json: dict) -> dict:
    return {k: v for k, v in sample_json.items() if k != "scenario"} | {
        "type": "LESSON",
        "level": "A1",
        "dialect": "MX",
        "languagePolicy": "BILINGUAL",
        "topic": unit_json["title"],
        "unit": unit_json,
        "goals": "I live in California and want to converse with Mexican friends.",
    }


@pytest.fixture
def lesson(lesson_json: dict) -> Brief:
    brief = Brief.model_validate(lesson_json)
    assert brief.type is SessionType.LESSON
    return brief

import json
from pathlib import Path

import pytest

from wafel_agent.brief import Brief

SAMPLE_PATH = Path(__file__).resolve().parent.parent / "sample_brief.json"


@pytest.fixture
def sample_json() -> dict:
    return json.loads(SAMPLE_PATH.read_text())


@pytest.fixture
def brief(sample_json: dict) -> Brief:
    return Brief.model_validate(sample_json)

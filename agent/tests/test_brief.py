from pathlib import Path

from wafel_agent.brief import (
    Brief,
    Cefr,
    CorrectionMode,
    MistakeCategory,
    Pace,
    SessionType,
    load_brief_file,
)


def test_parses_sample_brief(brief: Brief) -> None:
    assert brief.session_id == "sample-session"
    assert brief.type is SessionType.ROLEPLAY
    assert brief.level is Cefr.A2
    assert brief.correction_mode is CorrectionMode.SUBTLE
    assert brief.pace is Pace.SLOW
    assert brief.native_language == "en"
    assert brief.cap_minutes == 10
    assert brief.language.native_name == "Español"
    assert brief.scenario is not None
    assert brief.scenario.tutor_role == "camarero"
    assert brief.scenario.learner_role == "cliente"
    assert [v.word for v in brief.due_vocab] == ["la cuenta", "la bebida", "picante"]
    assert brief.recent_mistakes[0].category is MistakeCategory.AGREEMENT
    assert len(brief.memories) == 2


def test_optional_fields_default(sample_json: dict) -> None:
    minimal = {
        k: v
        for k, v in sample_json.items()
        if k not in {"goals", "scenario", "topic", "dueVocab", "recentMistakes", "memories"}
    }
    brief = Brief.model_validate(minimal)
    assert brief.goals is None
    assert brief.scenario is None
    assert brief.topic is None
    assert brief.due_vocab == []
    assert brief.recent_mistakes == []
    assert brief.memories == []


def test_round_trips_to_camel_case(brief: Brief) -> None:
    dumped = brief.model_dump(by_alias=True, mode="json")
    assert dumped["sessionId"] == "sample-session"
    assert dumped["correctionMode"] == "SUBTLE"
    assert dumped["scenario"]["tutorRole"] == "camarero"


def test_load_brief_file(tmp_path: Path, sample_json: dict) -> None:
    import json

    path = tmp_path / "b.json"
    path.write_text(json.dumps(sample_json))
    assert load_brief_file(path).session_id == "sample-session"

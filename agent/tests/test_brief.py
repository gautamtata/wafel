import json
from pathlib import Path

import pytest

from wafel_agent.brief import (
    Brief,
    Cefr,
    CorrectionMode,
    Dialect,
    LanguagePolicy,
    MistakeCategory,
    Pace,
    SessionType,
    load_brief_file,
    normalize_word,
    policy_for_level,
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


def test_v1_brief_gets_v2_defaults(brief: Brief) -> None:
    assert brief.dialect is Dialect.MX
    assert brief.language_policy is LanguagePolicy.BILINGUAL
    assert brief.policy is LanguagePolicy.BILINGUAL
    assert brief.unit is None


@pytest.mark.parametrize(
    ("level", "policy"),
    [
        (Cefr.A1, LanguagePolicy.BILINGUAL),
        (Cefr.A2, LanguagePolicy.BILINGUAL),
        (Cefr.B1, LanguagePolicy.MOSTLY_TARGET),
        (Cefr.B2, LanguagePolicy.TARGET_ONLY),
        (Cefr.C1, LanguagePolicy.TARGET_ONLY),
        (Cefr.C2, LanguagePolicy.TARGET_ONLY),
    ],
)
def test_policy_derived_from_level_when_missing(
    sample_json: dict, level: Cefr, policy: LanguagePolicy
) -> None:
    brief = Brief.model_validate(sample_json | {"level": level.value})
    assert brief.policy is policy
    assert policy_for_level(level) is policy


def test_explicit_policy_wins_over_level(sample_json: dict) -> None:
    brief = Brief.model_validate(sample_json | {"languagePolicy": "TARGET_ONLY"})
    assert brief.policy is LanguagePolicy.TARGET_ONLY


def test_parses_v2_lesson_brief(lesson: Brief, unit_json: dict) -> None:
    assert lesson.dialect is Dialect.MX
    assert lesson.policy is LanguagePolicy.BILINGUAL
    unit = lesson.unit
    assert unit is not None
    assert unit.id == "es-MX-A1-01"
    assert unit.can_do.startswith("I can")
    assert unit.pattern.name == unit_json["pattern"]["name"]
    assert unit.pattern.explanation_en == unit_json["pattern"]["explanationEn"]
    assert len(unit.pattern.examples) >= 2
    assert unit.pattern.examples[0].es and unit.pattern.examples[0].en
    assert len(unit.target_words) == len(unit_json["targetWords"])
    assert unit.target_words[0].example
    assert len(unit.model_sentences) == 5
    assert unit.scenario_hint == unit_json.get("scenarioHint")
    assert unit.word_scores["hola"].best == 3
    assert unit.word_scores["hola"].sessions == ["s1", "s2"]


def test_unit_best_score_matches_normalised_keys(lesson: Brief) -> None:
    assert lesson.unit is not None
    assert lesson.unit.best_score("hola") == 3
    assert lesson.unit.best_score("me llamo") == 1
    assert lesson.unit.best_score("¿cómo te llamas?") == 0
    scored = lesson.unit.model_copy(
        update={"word_scores": {"cómo te llamas": lesson.unit.word_scores["hola"]}}
    )
    assert scored.best_score("¿cómo te llamas?") == 3


def test_unit_without_scenario_hint_or_scores(lesson_json: dict) -> None:
    unit = {k: v for k, v in lesson_json["unit"].items() if k not in {"scenarioHint", "wordScores"}}
    brief = Brief.model_validate(lesson_json | {"unit": unit})
    assert brief.unit is not None
    assert brief.unit.scenario_hint is None
    assert brief.unit.word_scores == {}


@pytest.mark.parametrize(
    ("raw", "normalised"),
    [
        ("¿Cómo te llamas?", "cómo te llamas"),
        ("mexicano / mexicana", "mexicano"),
        ("la cuenta", "cuenta"),
        ("  Buenos   días ", "buenos días"),
    ],
)
def test_normalize_word(raw: str, normalised: str) -> None:
    assert normalize_word(raw) == normalised


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


def test_round_trips_to_camel_case(lesson: Brief) -> None:
    dumped = lesson.model_dump(by_alias=True, mode="json")
    assert dumped["sessionId"] == "sample-session"
    assert dumped["correctionMode"] == "SUBTLE"
    assert dumped["languagePolicy"] == "BILINGUAL"
    assert dumped["unit"]["canDo"].startswith("I can")
    assert dumped["unit"]["pattern"]["explanationEn"]


def test_load_brief_file(tmp_path: Path, sample_json: dict) -> None:
    path = tmp_path / "b.json"
    path.write_text(json.dumps(sample_json))
    assert load_brief_file(path).session_id == "sample-session"

import pytest

from tests.conftest import brief_unit, load_all_units
from wafel_agent.brief import (
    Brief,
    Cefr,
    CorrectionMode,
    Dialect,
    LanguagePolicy,
    Pace,
    SessionType,
)
from wafel_agent.prompts import (
    MAX_VOICE_PROMPT_CHARS,
    TOOL_NAMES,
    build_backend_prompt,
    build_voice_prompt,
)

LEVEL_MARKERS = {
    Cefr.A1: "presente de indicativo",
    Cefr.A2: "pretérito perfecto e indefinido",
    Cefr.B1: "subjuntivo presente básico",
    Cefr.B2: "subjuntivo completo",
    Cefr.C1: "ironía ligera",
    Cefr.C2: "sin restricciones",
}

POLICY_MARKERS = {
    LanguagePolicy.BILINGUAL: "luego su significado en inglés en la misma intervención",
    LanguagePolicy.MOSTLY_TARGET: "PRINCIPALMENTE ESPAÑOL",
    LanguagePolicy.TARGET_ONLY: "Habla solo español",
}

DIALECT_MARKERS = {
    Dialect.MX: "nunca «vosotros»",
    Dialect.ES: "español de España",
    Dialect.NEUTRAL: "español neutro",
}

ALL_UNITS = load_all_units()


def section_index(prompt: str, marker: str) -> int:
    index = prompt.find(marker)
    assert index >= 0, marker
    return index


def test_tool_names() -> None:
    assert TOOL_NAMES == (
        "save_vocab",
        "log_mistake",
        "show_note",
        "show_phrase",
        "rate_attempt",
        "end_lesson",
    )


def test_voice_prompt_core_rules(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert prompt.startswith("Operator rules")
    assert "Eres Wafel, tutor paciente de español mexicano" in prompt
    assert "una o dos frases" in prompt
    assert "Empieza tú" in prompt
    for name in TOOL_NAMES:
        assert name in prompt


def test_voice_prompt_section_order(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    markers = [
        "Eres Wafel",
        "Dialecto:",
        "Objetivo del alumno, en sus palabras",
        "Política de idioma",
        "Nivel A1",
        "Ritmo:",
        "Corrección:",
        "Modo lección, unidad",
        "Unidad «",
        "Vocabulario pendiente",
        "Errores recientes",
        "Lo que recuerdas",
        "Herramientas.",
        "Interrupciones:",
        "La sesión dura como máximo",
    ]
    positions = [section_index(prompt, m) for m in markers]
    assert positions == sorted(positions)


@pytest.mark.parametrize("dialect", list(Dialect))
def test_voice_prompt_dialect_block(lesson: Brief, dialect: Dialect) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"dialect": dialect}))
    assert DIALECT_MARKERS[dialect] in prompt
    for other, marker in DIALECT_MARKERS.items():
        if other is not dialect:
            assert marker not in prompt


def test_mx_dialect_block_content(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    for word in ("ustedes", "ahorita", "¿mande?", "chamba", "güey", "órale", "pesos", "taquería"):
        assert word in prompt


@pytest.mark.parametrize("policy", list(LanguagePolicy))
def test_voice_prompt_language_policy_block(lesson: Brief, policy: LanguagePolicy) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"language_policy": policy}))
    assert POLICY_MARKERS[policy] in prompt
    for other, marker in POLICY_MARKERS.items():
        if other is not policy:
            assert marker not in prompt


def test_bilingual_block_matches_spec(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert (
        "Di la frase en español, luego su significado en inglés en la misma intervención, "
        "y pide que la repita. Explicaciones y preguntas de comprensión en inglés. Si el "
        "alumno pregunta «¿qué significa…?», responde en inglés y vuelve al español."
    ) in prompt


def test_target_only_keeps_v1_lock_and_paraphrases_pattern(lesson: Brief) -> None:
    prompt = build_voice_prompt(
        lesson.model_copy(update={"language_policy": LanguagePolicy.TARGET_ONLY})
    )
    assert "No cambies de idioma por el acento" in prompt
    assert "si el alumno lo pide explícitamente" in prompt
    assert "parafraséala en español" in prompt
    assert "parafraseando en español la explicación de la unidad" in prompt
    assert "leyendo la explicación de la unidad" not in prompt


def test_bilingual_lesson_states_pattern_explanation_in_english(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert lesson.unit is not None
    assert lesson.unit.pattern.explanation_en in prompt
    assert "explica el patrón en inglés leyendo la explicación de la unidad" in prompt
    assert section_index(prompt, "Uno, presentación") < section_index(prompt, "Dos, práctica")


def test_goals_block(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert lesson.goals is not None
    assert f"«{lesson.goals}»" in prompt
    for word in ("carne asada", "fútbol", "mensajes de texto", "no manches", "chingón"):
        assert word in prompt
    assert "advertencia de registro en inglés" in prompt
    assert section_index(prompt, "Dialecto:") < section_index(prompt, "Objetivo del alumno")
    assert section_index(prompt, "Objetivo del alumno") < section_index(
        prompt, "Política de idioma"
    )


def test_goals_block_absent_without_goals(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"goals": None}))
    assert "Objetivo del alumno" not in prompt
    assert "carne asada" not in prompt


def test_interruption_policy(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert "detente, responde a lo que pregunta (en inglés si la política es bilingüe)" in prompt
    assert "y retoma donde ibas" in prompt
    assert (
        "Si el alumno pregunta por qué una palabra cambia (género, número, conjugación), "
        "explica la regla en inglés en dos frases con un ejemplo, y vuelve a la práctica."
    ) in prompt


@pytest.mark.parametrize("level", list(Cefr))
def test_voice_prompt_level_block(brief: Brief, level: Cefr) -> None:
    prompt = build_voice_prompt(brief.model_copy(update={"level": level}))
    assert LEVEL_MARKERS[level] in prompt
    for other, marker in LEVEL_MARKERS.items():
        if other is not level:
            assert marker not in prompt


def test_voice_prompt_pace(brief: Brief) -> None:
    assert "despacio" in build_voice_prompt(brief.model_copy(update={"pace": Pace.SLOW}))
    natural = build_voice_prompt(brief.model_copy(update={"pace": Pace.NATURAL}))
    assert "Ritmo: habla despacio" not in natural


@pytest.mark.parametrize("mode", list(CorrectionMode))
def test_voice_prompt_correction_mode(brief: Brief, mode: CorrectionMode) -> None:
    prompt = build_voice_prompt(brief.model_copy(update={"correction_mode": mode}))
    if mode is CorrectionMode.OFF:
        assert "No corrijas" in prompt
    elif mode is CorrectionMode.EXPLICIT:
        assert "modo explícito" in prompt
    else:
        assert "una por turno" in prompt


def test_voice_prompt_includes_brief_content(brief: Brief) -> None:
    prompt = build_voice_prompt(brief)
    for vocab in brief.due_vocab:
        assert vocab.word in prompt
    for mistake in brief.recent_mistakes:
        assert mistake.corrected in prompt
    for memory in brief.memories:
        assert memory in prompt
    assert brief.goals in prompt


def test_voice_prompt_roleplay_scenario(brief: Brief) -> None:
    prompt = build_voice_prompt(brief)
    assert brief.scenario is not None
    assert brief.scenario.tutor_role in prompt
    assert brief.scenario.learner_role in prompt
    assert brief.scenario.setting in prompt
    for goal in brief.scenario.goals:
        assert goal in prompt
    assert "Fuera del juego:" in prompt


def test_unit_block_content(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    unit = lesson.unit
    assert unit is not None
    assert f"Unidad «{unit.title}» (id {unit.id})" in prompt
    assert unit.can_do in prompt
    assert f"Patrón: {unit.pattern.name}" in prompt
    for example in unit.pattern.examples:
        assert f"{example.es} — {example.en}" in prompt
    for word in unit.target_words:
        assert f"{word.word} — {word.translation} — ej. «{word.example}»" in prompt
    for sentence in unit.model_sentences:
        assert f"{sentence.es} — {sentence.en}" in prompt
    assert unit.scenario_hint is not None
    assert unit.scenario_hint in prompt


def test_unit_block_word_scores(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert "hola — hi, hello — ej. «¡Hola! ¿Cómo estás?» — nota 3" in prompt
    assert "me llamo — my name is — ej. «Me llamo Sofía, ¿y tú?» — nota 1" in prompt
    assert "mucho gusto — nice to meet you — ej. «Mucho gusto, Javier.» — nota 0" in prompt
    assert "insiste en las más bajas" in prompt


def test_lesson_ppp_script(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert lesson.unit is not None
    assert "Uno, presentación (dos minutos)" in prompt
    assert "Dos, práctica controlada (cinco minutos)" in prompt
    assert "Tres, práctica libre (cinco minutos)" in prompt
    assert "Cuatro, comprobación (dos minutos)" in prompt
    assert "cinco frases modelo una por una: show_phrase" in prompt
    assert "tras cada intento, rate_attempt con kind WORD" in prompt
    assert "rate_attempt con kind PATTERN una sola vez" in prompt
    assert f"basado en «{lesson.unit.scenario_hint}»" in prompt
    assert "registra cada error real con log_mistake" in prompt


def test_lesson_without_unit_falls_back_to_topic(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"unit": None, "topic": "Pedir comida"}))
    assert "Modo lección sobre «Pedir comida»" in prompt
    assert "Uno, presentación" not in prompt
    assert "Unidad «" not in prompt


def test_shadowing_with_unit_script(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"type": SessionType.SHADOWING}))
    assert "Modo sombra (shadowing), unidad" in prompt
    assert "show_phrase, dila despacio, di su significado, pide que la repita" in prompt
    assert "rate_attempt con kind WORD" in prompt


def test_shadowing_without_unit_script(brief: Brief) -> None:
    prompt = build_voice_prompt(
        brief.model_copy(update={"type": SessionType.SHADOWING, "topic": "el mercado"})
    )
    assert "Modo sombra (shadowing) sobre el mercado" in prompt
    assert "show_phrase" in prompt


def test_mistake_review_adds_rate_attempt(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"type": SessionType.MISTAKE_REVIEW}))
    assert "corrige explícitamente" in prompt
    assert "palabra objetivo de la unidad, llama a rate_attempt con kind WORD" in prompt


def test_tool_policy_verbatim_target_and_authoritative_mistakes(lesson: Brief) -> None:
    prompt = build_voice_prompt(lesson)
    assert (
        "En target pasa SIEMPRE la palabra objetivo tal cual aparece en la lista de la unidad, "
        "letra por letra, aunque el alumno haya usado una forma conjugada, en femenino o en "
        "plural."
    ) in prompt
    assert "show_phrase: llámala con cada frase que presentes o pidas repetir" in prompt
    assert (
        "log_mistake es el registro oficial de errores: una llamada por cada error real" in prompt
    )
    assert "con la frase exacta que oíste" in prompt


@pytest.mark.parametrize("session_type", list(SessionType))
def test_voice_prompt_has_script_per_type(lesson: Brief, session_type: SessionType) -> None:
    prompt = build_voice_prompt(lesson.model_copy(update={"type": session_type}))
    assert len(prompt) < MAX_VOICE_PROMPT_CHARS


@pytest.mark.parametrize("unit", ALL_UNITS, ids=[u["id"] for u in ALL_UNITS])
def test_voice_prompt_length_bound_with_every_unit(lesson_json: dict, unit: dict) -> None:
    scores = {w["word"]: {"best": 2, "sessions": ["a", "b"]} for w in unit["targetWords"]}
    full = lesson_json | {"unit": brief_unit(unit, scores), "level": unit["id"].split("-")[2]}
    prompt = build_voice_prompt(Brief.model_validate(full))
    assert MAX_VOICE_PROMPT_CHARS == 14_000
    assert len(prompt) < MAX_VOICE_PROMPT_CHARS


def test_backend_prompt(lesson: Brief) -> None:
    prompt = build_backend_prompt(lesson)
    for name in TOOL_NAMES:
        assert name in prompt
    assert str(lesson.cap_minutes) in prompt
    assert lesson.session_id not in prompt
    assert "dialect MX" in prompt
    assert "language policy BILINGUAL" in prompt
    assert "VERBATIM" in prompt
    assert lesson.unit is not None
    for word in lesson.unit.target_words:
        assert word.word in prompt
    assert "authoritative" in prompt
    assert "One call per real learner error" in prompt
    assert "- show_phrase(spanish, english)" in prompt
    assert "- rate_attempt(target, kind, score, note?)" in prompt


def test_backend_prompt_without_unit(brief: Brief) -> None:
    prompt = build_backend_prompt(brief)
    assert "No unit in this session" in prompt


def test_backend_prompt_does_not_ask_model_to_end_on_cap(brief: Brief) -> None:
    """The model cannot observe the clock; the agent's cap timer ends the lesson itself."""
    prompt = build_backend_prompt(brief)
    end_line = next(line for line in prompt.splitlines() if line.startswith("- end_lesson"))
    assert "is reached" not in end_line
    assert "Do not call it for the time cap" in end_line

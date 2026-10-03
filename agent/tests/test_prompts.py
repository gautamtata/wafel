import pytest

from wafel_agent.brief import Brief, Cefr, CorrectionMode, Pace, SessionType
from wafel_agent.prompts import TOOL_NAMES, build_backend_prompt, build_voice_prompt

LEVEL_MARKERS = {
    Cefr.A1: "presente de indicativo",
    Cefr.A2: "pretérito perfecto e indefinido",
    Cefr.B1: "subjuntivo presente básico",
    Cefr.B2: "subjuntivo completo",
    Cefr.C1: "ironía ligera",
    Cefr.C2: "sin restricciones",
}


def test_tool_names() -> None:
    assert TOOL_NAMES == ("save_vocab", "log_mistake", "show_note", "end_lesson")


def test_voice_prompt_core_rules(brief: Brief) -> None:
    prompt = build_voice_prompt(brief)
    assert "Habla solo español" in prompt
    assert "No cambies de idioma por el acento" in prompt
    assert "si el alumno lo pide explícitamente" in prompt
    assert "Eres Wafel" in prompt
    assert "una o dos frases" in prompt
    assert len(prompt) < 12_000


@pytest.mark.parametrize("level", list(Cefr))
def test_voice_prompt_level_block(brief: Brief, level: Cefr) -> None:
    prompt = build_voice_prompt(brief.model_copy(update={"level": level}))
    assert LEVEL_MARKERS[level] in prompt
    for other, marker in LEVEL_MARKERS.items():
        if other is not level:
            assert marker not in prompt


def test_voice_prompt_pace(brief: Brief) -> None:
    assert "despacio" in build_voice_prompt(brief.model_copy(update={"pace": Pace.SLOW}))
    assert "despacio" not in build_voice_prompt(brief.model_copy(update={"pace": Pace.NATURAL}))


@pytest.mark.parametrize("mode", list(CorrectionMode))
def test_voice_prompt_correction_mode(brief: Brief, mode: CorrectionMode) -> None:
    prompts = {
        m: build_voice_prompt(brief.model_copy(update={"correction_mode": m}))
        for m in CorrectionMode
    }
    assert prompts[mode] != prompts[next(m for m in CorrectionMode if m is not mode)]
    if mode is CorrectionMode.OFF:
        assert "No corrijas" in prompts[mode]
    elif mode is CorrectionMode.EXPLICIT:
        assert "repetir" in prompts[mode]
    else:
        assert "una por turno" in prompts[mode]


def test_voice_prompt_includes_brief_content(brief: Brief) -> None:
    prompt = build_voice_prompt(brief)
    for vocab in brief.due_vocab:
        assert vocab.word in prompt
    for mistake in brief.recent_mistakes:
        assert mistake.corrected in prompt
    for memory in brief.memories:
        assert memory in prompt
    assert brief.goals in prompt
    for name in TOOL_NAMES:
        assert name in prompt


def test_voice_prompt_roleplay_scenario(brief: Brief) -> None:
    prompt = build_voice_prompt(brief)
    assert brief.scenario is not None
    assert brief.scenario.tutor_role in prompt
    assert brief.scenario.learner_role in prompt
    assert brief.scenario.setting in prompt
    for goal in brief.scenario.goals:
        assert goal in prompt
    assert "Fuera del juego:" in prompt


def test_voice_prompt_lesson_topic(brief: Brief) -> None:
    lesson = brief.model_copy(update={"type": SessionType.LESSON, "topic": "Pedir comida"})
    prompt = build_voice_prompt(lesson)
    assert "Pedir comida" in prompt
    assert "camarero" not in prompt


@pytest.mark.parametrize("session_type", list(SessionType))
def test_voice_prompt_has_script_per_type(brief: Brief, session_type: SessionType) -> None:
    prompt = build_voice_prompt(brief.model_copy(update={"type": session_type}))
    assert len(prompt) < 12_000
    if session_type is SessionType.MISTAKE_REVIEW:
        assert "corrige explícitamente" in prompt


def test_backend_prompt(brief: Brief) -> None:
    prompt = build_backend_prompt(brief)
    for name in TOOL_NAMES:
        assert name in prompt
    assert str(brief.cap_minutes) in prompt
    assert brief.session_id not in prompt


def test_backend_prompt_does_not_ask_model_to_end_on_cap(brief: Brief) -> None:
    """The model cannot observe the clock; the agent's cap timer ends the lesson itself."""
    prompt = build_backend_prompt(brief)
    end_line = next(line for line in prompt.splitlines() if line.startswith("- end_lesson"))
    assert "is reached" not in end_line
    assert "Do not call it for the time cap" in end_line

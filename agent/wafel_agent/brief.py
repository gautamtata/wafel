from __future__ import annotations

import json
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class SessionType(StrEnum):
    SHADOWING = "SHADOWING"
    LESSON = "LESSON"
    ROLEPLAY = "ROLEPLAY"
    FREE_TALK = "FREE_TALK"
    MISTAKE_REVIEW = "MISTAKE_REVIEW"


class Cefr(StrEnum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class CorrectionMode(StrEnum):
    SUBTLE = "SUBTLE"
    EXPLICIT = "EXPLICIT"
    OFF = "OFF"


class Pace(StrEnum):
    SLOW = "SLOW"
    NATURAL = "NATURAL"


class MistakeCategory(StrEnum):
    GRAMMAR = "GRAMMAR"
    VOCABULARY = "VOCABULARY"
    WORD_ORDER = "WORD_ORDER"
    AGREEMENT = "AGREEMENT"
    CONJUGATION = "CONJUGATION"
    PRONUNCIATION = "PRONUNCIATION"
    OTHER = "OTHER"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class Language(CamelModel):
    code: str
    name: str
    native_name: str


class Scenario(CamelModel):
    title: str
    setting: str
    tutor_role: str
    learner_role: str
    goals: list[str] = Field(default_factory=list)


class DueVocab(CamelModel):
    word: str
    translation: str


class RecentMistake(CamelModel):
    original: str
    corrected: str
    category: MistakeCategory


class Brief(CamelModel):
    session_id: str
    type: SessionType
    language: Language
    native_language: str
    level: Cefr
    correction_mode: CorrectionMode
    pace: Pace
    voice: str
    cap_minutes: int
    goals: str | None = None
    scenario: Scenario | None = None
    topic: str | None = None
    due_vocab: list[DueVocab] = Field(default_factory=list)
    recent_mistakes: list[RecentMistake] = Field(default_factory=list)
    memories: list[str] = Field(default_factory=list)


def load_brief_file(path: str | Path) -> Brief:
    return Brief.model_validate(json.loads(Path(path).read_text()))

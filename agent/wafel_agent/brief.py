from __future__ import annotations

import json
import re
import unicodedata
from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field, model_validator
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


class Dialect(StrEnum):
    MX = "MX"
    ES = "ES"
    NEUTRAL = "NEUTRAL"


class LanguagePolicy(StrEnum):
    BILINGUAL = "BILINGUAL"
    MOSTLY_TARGET = "MOSTLY_TARGET"
    TARGET_ONLY = "TARGET_ONLY"


class TargetKind(StrEnum):
    WORD = "WORD"
    PATTERN = "PATTERN"


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


class BilingualLine(CamelModel):
    es: str
    en: str


class UnitPattern(CamelModel):
    name: str
    explanation_en: str
    examples: list[BilingualLine] = Field(default_factory=list)


class TargetWord(CamelModel):
    word: str
    translation: str
    example: str


class WordScore(CamelModel):
    best: int = 0
    sessions: list[str] = Field(default_factory=list)


_ARTICLE = re.compile(r"^(el|la|los|las|un|una)\s+")
_PUNCTUATION = re.compile(r"[¿?¡!…,.]")


def normalize_word(word: str) -> str:
    """Mirror of the web's mastery.normalizeWord: the key used in wordScores."""
    bare = unicodedata.normalize("NFC", word).lower().split("/")[0]
    bare = re.sub(r"\s+", " ", _PUNCTUATION.sub(" ", bare)).strip()
    return _ARTICLE.sub("", bare).strip()


class BriefUnit(CamelModel):
    id: str
    title: str
    can_do: str
    pattern: UnitPattern
    target_words: list[TargetWord] = Field(default_factory=list)
    model_sentences: list[BilingualLine] = Field(default_factory=list)
    scenario_hint: str | None = None
    word_scores: dict[str, WordScore] = Field(default_factory=dict)

    def best_score(self, word: str) -> int:
        entry = self.word_scores.get(word) or self.word_scores.get(normalize_word(word))
        return entry.best if entry else 0


def policy_for_level(level: Cefr) -> LanguagePolicy:
    if level in (Cefr.A1, Cefr.A2):
        return LanguagePolicy.BILINGUAL
    if level is Cefr.B1:
        return LanguagePolicy.MOSTLY_TARGET
    return LanguagePolicy.TARGET_ONLY


class Brief(CamelModel):
    session_id: str
    type: SessionType
    language: Language
    native_language: str
    level: Cefr
    dialect: Dialect = Dialect.MX
    language_policy: LanguagePolicy | None = None
    correction_mode: CorrectionMode
    pace: Pace
    voice: str
    cap_minutes: int
    goals: str | None = None
    scenario: Scenario | None = None
    topic: str | None = None
    unit: BriefUnit | None = None
    due_vocab: list[DueVocab] = Field(default_factory=list)
    recent_mistakes: list[RecentMistake] = Field(default_factory=list)
    memories: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _default_policy(self) -> Brief:
        if self.language_policy is None:
            self.language_policy = policy_for_level(self.level)
        return self

    @property
    def policy(self) -> LanguagePolicy:
        assert self.language_policy is not None
        return self.language_policy


def load_brief_file(path: str | Path) -> Brief:
    return Brief.model_validate(json.loads(Path(path).read_text()))

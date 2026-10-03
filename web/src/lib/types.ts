import type {
  Cefr,
  CorrectionMode,
  Dialect,
  MistakeCategory,
  Pace,
  SessionType,
  UnitStatus,
} from "@/generated/prisma/enums";
import type { Score, WordScores } from "@/lib/mastery";
import type { ModelSentence, TargetWord, UnitPattern } from "@/lib/unit-schema";

export type VocabEntry = { word: string; translation: string };

export type LanguagePolicy = "BILINGUAL" | "MOSTLY_TARGET" | "TARGET_ONLY";

export type BriefUnit = {
  id: string;
  title: string;
  canDo: string;
  pattern: UnitPattern;
  targetWords: TargetWord[];
  modelSentences: ModelSentence[];
  scenarioHint?: string;
  wordScores: WordScores;
};

export type Brief = {
  sessionId: string;
  type: SessionType;
  language: { code: string; name: string; nativeName: string };
  nativeLanguage: string;
  level: Cefr;
  dialect: Dialect;
  languagePolicy: LanguagePolicy;
  correctionMode: CorrectionMode;
  pace: Pace;
  voice: string;
  capMinutes: number;
  goals?: string;
  scenario?: { title: string; setting: string; tutorRole: string; learnerRole: string; goals: string[] };
  topic?: string;
  unit?: BriefUnit;
  dueVocab: VocabEntry[];
  recentMistakes: { original: string; corrected: string; category: MistakeCategory }[];
  memories: string[];
};

export type TranscriptEntry = { role: "tutor" | "learner"; text: string; t: number };

export type RecapMistake = {
  original: string;
  corrected: string;
  explanation: string;
  category: MistakeCategory;
};

export type RecapUnitNextStep = { unitId: string | null; title: string | null; raiseLevelSuggested: boolean };

export type RecapUnit = {
  id: string;
  title: string;
  status: UnitStatus;
  wordsRated: { word: string; score: Score }[];
  patternScore: number;
  masteredWords: number;
  totalWords: number;
  nextStep: RecapUnitNextStep;
};

/** The part of the recap written by the text model; the rest comes from the live log and unit progress. */
export type RecapText = { summary: string; levelNote: string; memory: string; nextStep: string };

export type Recap = RecapText & {
  mistakes: RecapMistake[];
  newVocab: (VocabEntry & { example: string })[];
  unit?: RecapUnit;
};

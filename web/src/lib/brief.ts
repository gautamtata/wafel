import type {
  Language,
  Learner,
  Mistake,
  Scenario,
  SessionMemory,
  Unit,
  UnitProgress,
  VocabItem,
} from "@/generated/prisma/client";
import type { Cefr, SessionType } from "@/generated/prisma/enums";
import { levelIndex } from "@/lib/levels";
import type { WordScores } from "@/lib/mastery";
import type { Brief, BriefUnit, LanguagePolicy } from "@/lib/types";
import { unitContent } from "@/lib/units";

export type BriefInput = {
  session: { id: string; type: SessionType; topic: string | null };
  learner: Learner;
  language: Language;
  scenario: Scenario | null;
  unit?: Unit | null;
  progress?: UnitProgress | null;
  dueVocab: VocabItem[];
  mistakes: Mistake[];
  memories: SessionMemory[];
};

const MAX_VOCAB = 8;
const MAX_MISTAKES = 6;
const MAX_MEMORIES = 5;

const TOPIC_TYPES: ReadonlySet<SessionType> = new Set<SessionType>(["LESSON", "SHADOWING"]);
const UNIT_TYPES: ReadonlySet<SessionType> = new Set<SessionType>(["LESSON", "SHADOWING", "MISTAKE_REVIEW"]);

export function languagePolicyFor(level: Cefr): LanguagePolicy {
  const index = levelIndex(level);
  if (index <= levelIndex("A2")) return "BILINGUAL";
  if (index === levelIndex("B1")) return "MOSTLY_TARGET";
  return "TARGET_ONLY";
}

function briefUnit(unit: Unit, progress: UnitProgress | null | undefined): BriefUnit {
  const content = unitContent(unit);
  const wordScores = (progress?.wordScores as WordScores | undefined) ?? {};
  return {
    id: unit.id,
    title: unit.title,
    canDo: unit.canDo,
    pattern: content.pattern,
    targetWords: content.targetWords,
    modelSentences: content.modelSentences,
    ...(unit.scenarioHint ? { scenarioHint: unit.scenarioHint } : {}),
    wordScores,
  };
}

const oldestDueFirst = (a: VocabItem, b: VocabItem) => a.dueAt.getTime() - b.dueAt.getTime();
const newestFirst = (a: { createdAt: Date }, b: { createdAt: Date }) =>
  b.createdAt.getTime() - a.createdAt.getTime();

export function buildBrief({
  session,
  learner,
  language,
  scenario,
  unit,
  progress,
  dueVocab,
  mistakes,
  memories,
}: BriefInput): Brief {
  const roleplay = session.type === "ROLEPLAY" ? scenario : null;
  const lessonUnit = UNIT_TYPES.has(session.type) && unit ? unit : null;
  const topic = TOPIC_TYPES.has(session.type) ? (lessonUnit?.title ?? session.topic) : null;

  return {
    sessionId: session.id,
    type: session.type,
    language: { code: language.code, name: language.name, nativeName: language.nativeName },
    nativeLanguage: learner.nativeLanguage,
    level: learner.level,
    dialect: learner.dialect,
    languagePolicy: languagePolicyFor(learner.level),
    correctionMode: learner.correctionMode,
    pace: learner.pace,
    voice: learner.voice,
    capMinutes: learner.sessionCapMinutes,
    ...(learner.goals ? { goals: learner.goals } : {}),
    ...(roleplay
      ? {
          scenario: {
            title: roleplay.title,
            setting: roleplay.setting,
            tutorRole: roleplay.tutorRole,
            learnerRole: roleplay.learnerRole,
            goals: roleplay.goals,
          },
        }
      : {}),
    ...(topic ? { topic } : {}),
    ...(lessonUnit ? { unit: briefUnit(lessonUnit, progress) } : {}),
    dueVocab: [...dueVocab]
      .sort(oldestDueFirst)
      .slice(0, MAX_VOCAB)
      .map(({ word, translation }) => ({ word, translation })),
    recentMistakes: mistakes
      .filter((m) => !m.resolved)
      .sort(newestFirst)
      .slice(0, MAX_MISTAKES)
      .map(({ original, corrected, category }) => ({ original, corrected, category })),
    memories: [...memories]
      .sort(newestFirst)
      .slice(0, MAX_MEMORIES)
      .map((m) => m.summary),
  };
}

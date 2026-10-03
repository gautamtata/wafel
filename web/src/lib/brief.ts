import type {
  Language,
  Learner,
  Mistake,
  Scenario,
  SessionMemory,
  VocabItem,
} from "@/generated/prisma/client";
import type { SessionType } from "@/generated/prisma/enums";
import type { Brief } from "@/lib/types";

export type BriefInput = {
  session: { id: string; type: SessionType; topic: string | null };
  learner: Learner;
  language: Language;
  scenario: Scenario | null;
  dueVocab: VocabItem[];
  mistakes: Mistake[];
  memories: SessionMemory[];
};

const MAX_VOCAB = 8;
const MAX_MISTAKES = 6;
const MAX_MEMORIES = 5;

const TOPIC_TYPES: ReadonlySet<SessionType> = new Set<SessionType>(["LESSON", "SHADOWING"]);

const oldestDueFirst = (a: VocabItem, b: VocabItem) => a.dueAt.getTime() - b.dueAt.getTime();
const newestFirst = (a: { createdAt: Date }, b: { createdAt: Date }) =>
  b.createdAt.getTime() - a.createdAt.getTime();

export function buildBrief({
  session,
  learner,
  language,
  scenario,
  dueVocab,
  mistakes,
  memories,
}: BriefInput): Brief {
  const roleplay = session.type === "ROLEPLAY" ? scenario : null;
  const topic = TOPIC_TYPES.has(session.type) ? session.topic : null;

  return {
    sessionId: session.id,
    type: session.type,
    language: { code: language.code, name: language.name, nativeName: language.nativeName },
    nativeLanguage: learner.nativeLanguage,
    level: learner.level,
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

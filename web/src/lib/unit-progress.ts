import type { Learner, Unit, UnitProgress } from "@/generated/prisma/client";
import { Cefr, UnitStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { levelIndex } from "@/lib/levels";
import { masteredWordCount, normalizeWord, type WordScores } from "@/lib/mastery";
import type { RecapUnit, RecapUnitNextStep } from "@/lib/types";
import { getProgress, listUnits, nextUnitFor, unitContent, type UnitScope } from "@/lib/units";

const LEVELS = Object.values(Cefr);

export type UnitSummary = {
  id: string;
  level: Cefr;
  order: number;
  title: string;
  canDo: string;
  status: UnitStatus;
  masteredWords: number;
  totalWords: number;
  isCurrent: boolean;
};

export type PathView = {
  level: Cefr;
  currentUnitId: string | null;
  levels: { level: Cefr; units: UnitSummary[] }[];
};

type ProgressLearner = Pick<Learner, "id"> & UnitScope;

const scoresOf = (progress: UnitProgress | null | undefined): WordScores =>
  (progress?.wordScores as WordScores | null) ?? {};

function masteryOf(unit: Unit, progress: UnitProgress | null | undefined) {
  const { targetWords } = unitContent(unit);
  return {
    status: progress?.status ?? UnitStatus.NOT_STARTED,
    masteredWords: masteredWordCount({ wordScores: scoresOf(progress), patternScore: progress?.patternScore ?? 0 }, { targetWords }),
    totalWords: targetWords.length,
  };
}

function summarize(unit: Unit, progress: UnitProgress | null | undefined, currentUnitId: string | null): UnitSummary {
  return {
    id: unit.id,
    level: unit.level,
    order: unit.order,
    title: unit.title,
    canDo: unit.canDo,
    ...masteryOf(unit, progress),
    isCurrent: unit.id === currentUnitId,
  };
}

/** Levels shown on the path: the learner's level and its neighbours. */
export function neighbouringLevels(level: Cefr): Cefr[] {
  const index = levelIndex(level);
  return LEVELS.slice(Math.max(0, index - 1), index + 2);
}

export async function listUnitSummaries(learner: ProgressLearner, levels: readonly Cefr[]): Promise<UnitSummary[]> {
  const scope = { language: learner.targetLanguage, dialect: learner.dialect };
  const [units, rows, current] = await Promise.all([
    listUnits(scope),
    db.unitProgress.findMany({ where: { learnerId: learner.id } }),
    nextUnitFor(learner),
  ]);
  const progress = new Map(rows.map((row) => [row.unitId, row]));
  return units
    .filter((unit) => levels.includes(unit.level))
    .map((unit) => summarize(unit, progress.get(unit.id), current?.id ?? null));
}

export async function pathFor(learner: ProgressLearner): Promise<PathView> {
  const levels = neighbouringLevels(learner.level);
  const units = await listUnitSummaries(learner, levels);
  return {
    level: learner.level,
    currentUnitId: units.find((unit) => unit.isCurrent)?.id ?? null,
    levels: levels.map((level) => ({ level, units: units.filter((unit) => unit.level === level) })),
  };
}

export async function nextStepFor(learner: ProgressLearner): Promise<RecapUnitNextStep> {
  const next = await nextUnitFor(learner);
  return {
    unitId: next?.id ?? null,
    title: next?.title ?? null,
    raiseLevelSuggested: !!next && levelIndex(next.level) > levelIndex(learner.level),
  };
}

function wordsRatedIn(unit: Unit, scores: WordScores, sessionId: string): RecapUnit["wordsRated"] {
  const labels = new Map(unitContent(unit).targetWords.map(({ word }) => [normalizeWord(word), word]));
  return Object.entries(scores)
    .filter(([, entry]) => entry.sessions.includes(sessionId))
    .map(([key, entry]) => ({ word: labels.get(key) ?? key, best: entry.best }));
}

export async function recapUnitFor(unit: Unit, sessionId: string, learner: ProgressLearner): Promise<RecapUnit> {
  const [progress, nextStep] = await Promise.all([getProgress(learner.id, unit.id), nextStepFor(learner)]);
  return {
    id: unit.id,
    title: unit.title,
    ...masteryOf(unit, progress),
    wordsRated: wordsRatedIn(unit, scoresOf(progress), sessionId),
    patternScore: progress?.patternScore ?? 0,
    nextStep,
  };
}

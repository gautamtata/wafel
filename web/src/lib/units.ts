import type { Learner, Unit, UnitProgress } from "@/generated/prisma/client";
import { Cefr, UnitStatus, type Dialect } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { levelIndex } from "@/lib/levels";
import type { ModelSentence, TargetWord, UnitPattern } from "@/lib/unit-schema";

const LEVELS = Object.values(Cefr);
const byLevelAndOrder = [{ level: "asc" }, { order: "asc" }] as const;

export type UnitScope = Pick<Learner, "targetLanguage" | "dialect" | "level">;

/** Typed view of a Unit row's JSON columns. */
export function unitContent(unit: Pick<Unit, "pattern" | "targetWords" | "modelSentences">) {
  return {
    pattern: unit.pattern as UnitPattern,
    targetWords: unit.targetWords as TargetWord[],
    modelSentences: unit.modelSentences as ModelSentence[],
  };
}

export function listUnits(
  scope: { language: string; dialect: Dialect },
  level?: Cefr,
): Promise<Unit[]> {
  return db.unit.findMany({
    where: { language: scope.language, dialect: scope.dialect, ...(level ? { level } : {}) },
    orderBy: [...byLevelAndOrder],
  });
}

export function getUnit(id: string): Promise<Unit | null> {
  return db.unit.findUnique({ where: { id } });
}

export function getProgress(learnerId: string, unitId: string): Promise<UnitProgress | null> {
  return db.unitProgress.findUnique({ where: { learnerId_unitId: { learnerId, unitId } } });
}

/** Pure selection: first non-mastered unit at `level`, else the first unit of the next level, else null. */
export function selectNextUnit<U extends Pick<Unit, "id" | "level" | "order">>(
  units: readonly U[],
  masteredIds: ReadonlySet<string>,
  level: Cefr,
): U | null {
  const sorted = [...units].sort((a, b) => levelIndex(a.level) - levelIndex(b.level) || a.order - b.order);
  const current = sorted.find((u) => u.level === level && !masteredIds.has(u.id));
  if (current) return current;
  for (const next of LEVELS.slice(levelIndex(level) + 1)) {
    const first = sorted.find((u) => u.level === next);
    if (first) return first;
  }
  return null;
}

export async function nextUnitFor(learner: Pick<Learner, "id"> & UnitScope): Promise<Unit | null> {
  const [units, mastered] = await Promise.all([
    listUnits({ language: learner.targetLanguage, dialect: learner.dialect }),
    db.unitProgress.findMany({
      where: { learnerId: learner.id, status: UnitStatus.MASTERED },
      select: { unitId: true },
    }),
  ]);
  return selectNextUnit(units, new Set(mastered.map((p) => p.unitId)), learner.level);
}

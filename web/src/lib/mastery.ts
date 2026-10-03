import type { TargetKind, UnitStatus } from "@/generated/prisma/enums";

export type Score = 0 | 1 | 2 | 3;
export type Rating = { target: string; kind: TargetKind; score: Score; note?: string };
export type WordScore = { best: Score; sessions: string[] };
export type WordScores = Record<string, WordScore>;
export type MasteryProgress = { wordScores: WordScores; patternScore: number };
type UnitWords = { targetWords: readonly { word: string }[] };

export const MASTERY_SCORE = 2;
export const MASTERY_SESSIONS = 2;
export const MASTERY_WORD_RATIO = 0.8;

const ARTICLE = /^(el|la|los|las|un|una)\s+/;
const PUNCTUATION = /[¿?¡!…,.]/g;

/** Loose form used to match a rating target against a unit word ("¿Cuánto cuesta?" → "cuánto cuesta"). */
export function normalizeWord(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .split("/")[0]
    .replace(PUNCTUATION, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(ARTICLE, "")
    .trim();
}

export const emptyProgress = (): MasteryProgress => ({ wordScores: {}, patternScore: 0 });

export function isWordMastered(entry: WordScore | undefined): boolean {
  return !!entry && entry.best >= MASTERY_SCORE && new Set(entry.sessions).size >= MASTERY_SESSIONS;
}

export function applyRating<P extends MasteryProgress>(progress: P, rating: Rating, sessionId: string): P {
  if (rating.kind === "PATTERN") {
    return { ...progress, patternScore: Math.max(progress.patternScore, rating.score) };
  }
  const word = normalizeWord(rating.target);
  const previous = progress.wordScores[word] ?? { best: 0, sessions: [] };
  const sessions = previous.sessions.includes(sessionId) ? previous.sessions : [...previous.sessions, sessionId];
  const best = Math.max(previous.best, rating.score) as Score;
  return { ...progress, wordScores: { ...progress.wordScores, [word]: { best, sessions } } };
}

export function masteredWordCount(progress: MasteryProgress, unit: UnitWords): number {
  return unit.targetWords.filter(({ word }) => isWordMastered(progress.wordScores[normalizeWord(word)])).length;
}

/** Whether any rating is recorded; a PATTERN rating of 0 leaves no trace, so callers that just applied one pass `rated`. */
export const hasRatings = (progress: MasteryProgress): boolean =>
  Object.keys(progress.wordScores).length > 0 || progress.patternScore > 0;

export function computeUnitStatus(
  progress: MasteryProgress,
  unit: UnitWords,
  rated: boolean = hasRatings(progress),
): UnitStatus {
  if (!rated) return "NOT_STARTED";
  const total = unit.targetWords.length;
  const mastered = total > 0 && masteredWordCount(progress, unit) / total >= MASTERY_WORD_RATIO;
  return mastered && progress.patternScore >= MASTERY_SCORE ? "MASTERED" : "IN_PROGRESS";
}

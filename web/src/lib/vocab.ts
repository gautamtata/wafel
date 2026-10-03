import { z } from "zod";
import type { VocabItem } from "@/generated/prisma/client";
import { notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import { normalize } from "@/lib/recap-validate";
import { type Grade, initialState, review } from "@/lib/srs";

export const gradeSchema = z.object({ grade: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) });

export type VocabInput = {
  word: string;
  translation: string;
  example?: string;
  sourceSessionId?: string;
};

async function findByNormalizedWord(word: string): Promise<VocabItem | null> {
  const needle = normalize(word);
  const items = await db.vocabItem.findMany({ where: { learnerId: OWNER_ID }, select: { id: true, word: true } });
  const match = items.find((item) => normalize(item.word) === needle);
  return match ? db.vocabItem.findUnique({ where: { id: match.id } }) : null;
}

export async function addVocab(input: VocabInput): Promise<VocabItem> {
  const word = input.word.trim();
  const translation = input.translation.trim();
  const example = input.example?.trim() || null;
  const existing = await findByNormalizedWord(word);
  if (existing) {
    return db.vocabItem.update({
      where: { id: existing.id },
      data: { translation, example: example ?? existing.example },
    });
  }
  return db.vocabItem.create({
    data: {
      learnerId: OWNER_ID,
      word,
      translation,
      example,
      sourceSessionId: input.sourceSessionId ?? null,
      ...initialState(),
    },
  });
}

export async function listVocab(options: { dueOnly?: boolean } = {}): Promise<VocabItem[]> {
  return db.vocabItem.findMany({
    where: { learnerId: OWNER_ID, ...(options.dueOnly ? { dueAt: { lte: new Date() } } : {}) },
    orderBy: [{ dueAt: "asc" }, { word: "asc" }],
  });
}

export async function countDueVocab(): Promise<number> {
  return db.vocabItem.count({ where: { learnerId: OWNER_ID, dueAt: { lte: new Date() } } });
}

export async function reviewVocab(id: string, grade: Grade): Promise<VocabItem> {
  const item = await db.vocabItem.findUnique({ where: { id } });
  if (!item || item.learnerId !== OWNER_ID) throw notFound("Vocab item");
  const now = new Date();
  const next = review(item, grade, now);
  return db.vocabItem.update({ where: { id }, data: { ...next, lastReviewedAt: now } });
}

export async function deleteVocab(id: string): Promise<void> {
  const { count } = await db.vocabItem.deleteMany({ where: { id, learnerId: OWNER_ID } });
  if (count === 0) throw notFound("Vocab item");
}

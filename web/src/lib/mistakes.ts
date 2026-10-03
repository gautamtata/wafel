import type { Mistake, MistakeCategory } from "@/generated/prisma/client";
import { notFound } from "@/lib/api";
import { db } from "@/lib/db";
import { OWNER_ID } from "@/lib/owner";
import { normalize } from "@/lib/recap-validate";

export type MistakeInput = {
  sessionId: string;
  original: string;
  corrected: string;
  explanation: string;
  category: MistakeCategory;
};

export async function mistakesForSession(sessionId: string): Promise<Mistake[]> {
  return db.mistake.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
}

export async function logMistake(input: MistakeInput): Promise<Mistake> {
  const needle = normalize(input.original);
  const existing = (await mistakesForSession(input.sessionId)).find(
    (m) => normalize(m.original) === needle,
  );
  if (existing) return existing;
  return db.mistake.create({ data: { ...input, learnerId: OWNER_ID } });
}

export async function listMistakes(): Promise<Mistake[]> {
  return db.mistake.findMany({
    where: { learnerId: OWNER_ID },
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
  });
}

export async function countUnresolvedMistakes(): Promise<number> {
  return db.mistake.count({ where: { learnerId: OWNER_ID, resolved: false } });
}

export async function setMistakeResolved(id: string, resolved: boolean): Promise<Mistake> {
  const mistake = await db.mistake.findUnique({ where: { id } });
  if (!mistake || mistake.learnerId !== OWNER_ID) throw notFound("Mistake");
  return db.mistake.update({ where: { id }, data: { resolved } });
}

import { cache } from "react";
import type { Learner } from "@/generated/prisma/client";
import { Cefr, CorrectionMode, Dialect, Pace } from "@/generated/prisma/enums";
import { ApiError } from "@/lib/api";
import { db } from "@/lib/db";
import { GOALS_MAX_LENGTH, SESSION_CAP_RANGE } from "@/lib/learner-limits";
import { VOICES } from "@/lib/prompts-meta";

export const OWNER_ID = "owner";

type Editable = Omit<Learner, "id" | "createdAt" | "updatedAt">;
export type LearnerUpdate = Partial<Editable>;

const INVALID = Symbol("invalid");
type Parse<T> = (value: unknown) => T | typeof INVALID;

const oneOf =
  <T extends string>(values: readonly T[]): Parse<T> =>
  (value) =>
    typeof value === "string" && (values as readonly string[]).includes(value)
      ? (value as T)
      : INVALID;

const languageCode: Parse<string> = (value) =>
  typeof value === "string" && /^[a-z]{2,3}(-[A-Z]{2})?$/.test(value) ? value : INVALID;

const capMinutes: Parse<number> = (value) =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= SESSION_CAP_RANGE.min &&
  value <= SESSION_CAP_RANGE.max
    ? value
    : INVALID;

const goals: Parse<string | null> = (value) => {
  if (value === null) return null;
  if (typeof value !== "string") return INVALID;
  const trimmed = value.trim();
  if (trimmed.length > GOALS_MAX_LENGTH) return INVALID;
  return trimmed || null;
};

const timestamp: Parse<Date | null> = (value) => {
  if (value === null) return null;
  if (typeof value !== "string") return INVALID;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? INVALID : date;
};

const PARSERS: { [K in keyof Editable]: Parse<Editable[K]> } = {
  targetLanguage: languageCode,
  nativeLanguage: languageCode,
  level: oneOf(Object.values(Cefr)),
  dialect: oneOf(Object.values(Dialect)),
  goals,
  correctionMode: oneOf(Object.values(CorrectionMode)),
  pace: oneOf(Object.values(Pace)),
  voice: oneOf(VOICES.map((v) => v.id)),
  sessionCapMinutes: capMinutes,
  onboardedAt: timestamp,
};

export type ParseResult = { ok: true; data: LearnerUpdate } | { ok: false; error: string };

function assignField<K extends keyof Editable>(
  data: LearnerUpdate,
  key: K,
  value: unknown,
): boolean {
  const parsed = PARSERS[key](value);
  if (parsed === INVALID) return false;
  data[key] = parsed;
  return true;
}

export function parseLearnerUpdate(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Expected an object" };
  }
  const input = body as Record<string, unknown>;
  const data: LearnerUpdate = {};
  for (const key of Object.keys(PARSERS) as (keyof Editable)[]) {
    if (key in input && !assignField(data, key, input[key])) {
      return { ok: false, error: `Invalid ${key}` };
    }
  }
  return { ok: true, data };
}

const CREATE_DEFAULTS = {
  targetLanguage: "es",
  level: Cefr.A1,
  voice: VOICES[0].id,
} satisfies Partial<Editable>;

export const getLearner = cache(
  (): Promise<Learner | null> => db.learner.findUnique({ where: { id: OWNER_ID } }),
);

export async function requireLearner(): Promise<Learner> {
  const learner = await getLearner();
  if (!learner) throw new ApiError("Learner has not completed onboarding", 409);
  return learner;
}

export function upsertLearner(data: LearnerUpdate): Promise<Learner> {
  return db.learner.upsert({
    where: { id: OWNER_ID },
    update: data,
    create: { ...CREATE_DEFAULTS, ...data, id: OWNER_ID },
  });
}

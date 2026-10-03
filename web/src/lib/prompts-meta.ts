import type { Cefr, CorrectionMode, Dialect, Pace, UnitStatus } from "@/generated/prisma/enums";

export type LevelDescriptor = { title: string; description: string };
export type OptionMeta = { label: string; description: string };
export type VoiceMeta = { id: string; label: string; description: string };

export const LEVEL_DESCRIPTORS: Record<Cefr, LevelDescriptor> = {
  A1: {
    title: "Beginner",
    description: "I know a few words and phrases. I can greet people and say simple things about myself.",
  },
  A2: {
    title: "Elementary",
    description: "I can handle simple, routine exchanges: shopping, directions, talking about my day.",
  },
  B1: {
    title: "Intermediate",
    description: "I can get by when travelling and talk about familiar topics, plans and experiences.",
  },
  B2: {
    title: "Upper intermediate",
    description: "I can hold a fairly fluent conversation with native speakers and argue a point of view.",
  },
  C1: {
    title: "Advanced",
    description: "I express myself fluently and flexibly, including at work, with only occasional searching for words.",
  },
  C2: {
    title: "Proficient",
    description: "I understand virtually everything and can express fine shades of meaning effortlessly.",
  },
};

export const CORRECTION_MODES: Record<CorrectionMode, OptionMeta> = {
  SUBTLE: {
    label: "Subtle",
    description: "The tutor repeats your sentence back correctly, without stopping the conversation.",
  },
  EXPLICIT: {
    label: "Explicit",
    description: "The tutor pauses, explains the correction briefly and asks you to try again.",
  },
  OFF: {
    label: "Off",
    description: "No corrections during the session. Mistakes still appear in your recap.",
  },
};

export const PACES: Record<Pace, OptionMeta> = {
  SLOW: { label: "Slow", description: "Clear, unhurried speech with pauses between ideas." },
  NATURAL: { label: "Natural", description: "Everyday conversational speed." },
};

export const DIALECTS: Record<Dialect, OptionMeta> = {
  MX: {
    label: "Mexico",
    description: "Mexican Spanish: ustedes, Mexican vocabulary and everyday Mexican settings. Your unit path is written for it.",
  },
  ES: {
    label: "Spain",
    description: "Castilian Spanish: vosotros and peninsular vocabulary. The unit path is Mexican-only for now.",
  },
  NEUTRAL: {
    label: "Neutral",
    description: "Broadly understood Latin American Spanish without strong regional slang. The unit path is Mexican-only for now.",
  },
};

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  MASTERED: "Mastered",
};

export const VOICES: readonly VoiceMeta[] = [
  { id: "marin", label: "Marin", description: "Clear and warm, natural conversational tone." },
  { id: "cedar", label: "Cedar", description: "Calm and grounded, steady delivery." },
  { id: "alloy", label: "Alloy", description: "Balanced and neutral." },
  { id: "ash", label: "Ash", description: "Relaxed and friendly." },
  { id: "ballad", label: "Ballad", description: "Soft and expressive." },
  { id: "coral", label: "Coral", description: "Bright and upbeat." },
  { id: "echo", label: "Echo", description: "Even and measured." },
  { id: "sage", label: "Sage", description: "Gentle and patient." },
  { id: "shimmer", label: "Shimmer", description: "Light and energetic." },
  { id: "verse", label: "Verse", description: "Lively and animated." },
];

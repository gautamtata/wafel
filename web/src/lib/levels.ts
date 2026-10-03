import { Cefr } from "@/generated/prisma/enums";

const LEVEL_ORDER = Object.values(Cefr);

export const levelIndex = (level: Cefr): number => LEVEL_ORDER.indexOf(level);

export const levelsUpTo = (level: Cefr): Cefr[] => LEVEL_ORDER.slice(0, levelIndex(level) + 1);

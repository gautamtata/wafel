import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Cefr } from "@/generated/prisma/enums";
import { UNIT_LEVELS, unitFileSchema, unitLevelOf, type UnitContent } from "@/lib/unit-schema";

export const CONTENT_DIR = resolve(process.cwd(), "content/units/es-MX");

export type ContentFile = { level: Cefr; path: string; units: UnitContent[] };

/** Parse `<dir>/<LEVEL>.json`; null when the file does not exist, throws when it is invalid. */
export function loadContentFile(level: Cefr, dir = CONTENT_DIR): ContentFile | null {
  const path = resolve(dir, `${level}.json`);
  if (!existsSync(path)) return null;
  const units = unitFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const wrongLevel = units.filter((u) => unitLevelOf(u) !== level);
  if (wrongLevel.length > 0) {
    throw new Error(`${path}: ids not at level ${level}: ${wrongLevel.map((u) => u.id).join(", ")}`);
  }
  return { level, path, units };
}

export function loadAllContent(dir = CONTENT_DIR): ContentFile[] {
  return UNIT_LEVELS.flatMap((level) => loadContentFile(level, dir) ?? []);
}

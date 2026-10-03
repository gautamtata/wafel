import type { Language } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export function listLanguages(): Promise<Language[]> {
  return db.language.findMany({ orderBy: [{ enabled: "desc" }, { name: "asc" }] });
}

export async function isEnabledLanguage(code: string): Promise<boolean> {
  const language = await db.language.findUnique({ where: { code } });
  return language?.enabled ?? false;
}

import { MistakeCategory } from "@/generated/prisma/enums";

export const MISTAKE_CATEGORY_LABELS: Record<MistakeCategory, string> = {
  GRAMMAR: "Grammar",
  VOCABULARY: "Vocabulary",
  WORD_ORDER: "Word order",
  AGREEMENT: "Agreement",
  CONJUGATION: "Conjugation",
  PRONUNCIATION: "Pronunciation",
  OTHER: "Other",
};

const CATEGORY_ORDER = Object.values(MistakeCategory);

type Groupable = { category: MistakeCategory; resolved: boolean };

export type MistakeGroupOf<T extends Groupable> = {
  category: MistakeCategory;
  label: string;
  mistakes: T[];
  openCount: number;
};

export function groupMistakes<T extends Groupable>(mistakes: T[]): MistakeGroupOf<T>[] {
  const byCategory = new Map<MistakeCategory, T[]>();
  for (const mistake of mistakes) {
    byCategory.set(mistake.category, [...(byCategory.get(mistake.category) ?? []), mistake]);
  }
  return [...byCategory]
    .map(([category, items]) => ({
      category,
      label: MISTAKE_CATEGORY_LABELS[category],
      mistakes: items,
      openCount: items.filter((m) => !m.resolved).length,
    }))
    .sort(
      (a, b) =>
        b.mistakes.length - a.mistakes.length ||
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
    );
}

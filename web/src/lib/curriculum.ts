import type { Cefr } from "@/generated/prisma/enums";

export const CURRICULUM: Record<Cefr, readonly string[]> = {
  A1: [
    "Greetings and introductions",
    "Numbers, prices and time",
    "Ordering food and drink",
    "Daily routine",
    "Family and friends",
    "Getting around the city",
    "Shopping basics",
    "Weather and seasons",
  ],
  A2: [
    "Talking about last weekend",
    "Describing your home",
    "Making plans and invitations",
    "At the doctor's",
    "Hobbies and free time",
    "Travel and hotels",
    "Describing people",
    "Childhood memories",
  ],
  B1: [
    "Work and studies",
    "Telling a story from your past",
    "Giving advice and recommendations",
    "Health and lifestyle",
    "Making complaints politely",
    "Plans, hopes and ambitions",
    "Films, books and music",
    "Cultural customs and traditions",
  ],
  B2: [
    "Technology in everyday life",
    "Environment and climate",
    "Hypothetical situations",
    "News and current events",
    "Job interviews",
    "Comparing cities and cultures",
    "Negotiating and persuading",
    "Relationships and social life",
  ],
  C1: [
    "Debating social issues",
    "Work culture and productivity",
    "Media, advertising and influence",
    "Science and ethics",
    "Education systems",
    "Humor, idioms and wordplay",
    "Presenting and defending an opinion",
    "Migration and identity",
  ],
  C2: [
    "Philosophy and abstract ideas",
    "Politics and rhetoric",
    "Literature and literary analysis",
    "Regional varieties of the language",
    "Economics and globalization",
    "Arguing both sides of a controversy",
    "Art criticism and aesthetics",
    "Language, power and nuance",
  ],
};

export function nextTopic(level: Cefr, covered: readonly string[]): string {
  const topics = CURRICULUM[level];
  const seen = new Set(covered);
  return topics.find((topic) => !seen.has(topic)) ?? topics[0];
}

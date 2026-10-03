import { db } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";

const languages: Prisma.LanguageCreateInput[] = [
  { code: "es", name: "Spanish", nativeName: "Español", voice: "marin", enabled: true },
  { code: "fr", name: "French", nativeName: "Français", voice: "marin", enabled: false },
  { code: "de", name: "German", nativeName: "Deutsch", voice: "marin", enabled: false },
  { code: "ja", name: "Japanese", nativeName: "日本語", voice: "marin", enabled: false },
  { code: "it", name: "Italian", nativeName: "Italiano", voice: "marin", enabled: false },
  { code: "pt", name: "Portuguese", nativeName: "Português", voice: "marin", enabled: false },
];

const scenarios: Prisma.ScenarioCreateInput[] = [
  {
    id: "es-restaurant",
    language: "es",
    title: "Ordering at a restaurant",
    description: "Sit down at a neighborhood restaurant, ask about the menu, and order a meal.",
    minLevel: "A1",
    setting: "A small, busy restaurant in Madrid at lunchtime.",
    tutorRole: "A friendly waiter taking your order.",
    learnerRole: "A customer eating alone, ordering food and drink.",
    goals: [
      "Greet the waiter and ask for a table",
      "Ask what a dish is and order a main course and a drink",
      "Ask for the bill and say thank you",
    ],
  },
  {
    id: "es-market",
    language: "es",
    title: "Shopping at the market",
    description: "Buy fruit and vegetables from a market stall and handle prices and quantities.",
    minLevel: "A1",
    setting: "An open-air produce market on a Saturday morning.",
    tutorRole: "A talkative vendor at a fruit and vegetable stall.",
    learnerRole: "A shopper buying ingredients for dinner.",
    goals: [
      "Ask for three different items by name and quantity",
      "Ask how much something costs and respond to the price",
      "Pay and say goodbye politely",
    ],
  },
  {
    id: "es-directions",
    language: "es",
    title: "Asking for directions",
    description: "Find your way to a landmark by asking a stranger for directions.",
    minLevel: "A1",
    setting: "A street corner in the old town; you are lost on your way to the cathedral.",
    tutorRole: "A helpful local passerby who knows the area well.",
    learnerRole: "A visitor trying to reach the cathedral on foot.",
    goals: [
      "Politely stop someone and ask where the cathedral is",
      "Understand directions with left, right, and straight ahead",
      "Confirm how long it takes to walk there and thank them",
    ],
  },
  {
    id: "es-pharmacy",
    language: "es",
    title: "At the pharmacy",
    description: "Describe mild symptoms to a pharmacist and get the right remedy.",
    minLevel: "A2",
    setting: "A quiet pharmacy in the afternoon.",
    tutorRole: "A patient pharmacist who asks follow-up questions.",
    learnerRole: "A customer with a headache and a sore throat.",
    goals: [
      "Describe your symptoms and how long you have had them",
      "Understand the pharmacist's advice and dosage instructions",
      "Ask whether you need a prescription and how much it costs",
    ],
  },
  {
    id: "es-neighbor",
    language: "es",
    title: "Meeting a new neighbor",
    description: "Introduce yourself to a neighbor and make small talk about the building and the area.",
    minLevel: "A2",
    setting: "The hallway of an apartment building; you have just moved in.",
    tutorRole: "A warm, curious neighbor who has lived there for years.",
    learnerRole: "A newcomer who moved in last week.",
    goals: [
      "Introduce yourself and say where you are from and what you do",
      "Ask about the neighborhood: shops, transport, and quiet hours",
      "Accept or decline an invitation for coffee and arrange a time",
    ],
  },
  {
    id: "es-hotel",
    language: "es",
    title: "Checking into a hotel",
    description: "Check in, ask about hotel services, and resolve a small problem with your room.",
    minLevel: "A2",
    setting: "The reception desk of a mid-range hotel in the evening.",
    tutorRole: "A professional receptionist handling check-in.",
    learnerRole: "A traveler with a reservation for two nights.",
    goals: [
      "Confirm your reservation and provide your details",
      "Ask about breakfast, Wi-Fi, and checkout time",
      "Report that the room's air conditioning is not working and ask for a fix",
    ],
  },
  {
    id: "es-job-interview",
    language: "es",
    title: "A job interview",
    description: "Talk about your experience, strengths, and goals in a short job interview.",
    minLevel: "B1",
    setting: "A meeting room at a small company; a first-round interview.",
    tutorRole: "A hiring manager asking standard interview questions.",
    learnerRole: "A candidate applying for a role in your own field.",
    goals: [
      "Summarize your background and current role",
      "Describe a challenge you solved and what you learned",
      "Ask two questions about the team and next steps",
    ],
  },
];

async function main() {
  for (const language of languages) {
    await db.language.upsert({
      where: { code: language.code },
      create: language,
      update: language,
    });
  }
  for (const scenario of scenarios) {
    await db.scenario.upsert({
      where: { id: scenario.id },
      create: scenario,
      update: scenario,
    });
  }
  console.log(`Seeded ${languages.length} languages and ${scenarios.length} scenarios.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

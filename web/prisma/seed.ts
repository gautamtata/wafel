import { db } from "../src/lib/db";
import type { Prisma } from "../src/generated/prisma/client";
import { loadAllContent } from "../src/lib/unit-content";

const UNIT_LANGUAGE = "es";
const UNIT_DIALECT = "MX";

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
    setting: "A busy taquería in Colonia Roma, Mexico City, at lunchtime.",
    tutorRole: "A friendly taquero taking your order at the counter.",
    learnerRole: "A customer eating alone, ordering tacos and an agua fresca.",
    goals: [
      "Greet the taquero and ask what is on the menu today",
      "Order tacos al pastor with everything and an agua de horchata",
      "Ask how much it is in pesos, pay, and say thank you",
    ],
  },
  {
    id: "es-market",
    language: "es",
    title: "Shopping at the market",
    description: "Buy fruit, vegetables and chiles at a mercado stall and handle prices in pesos.",
    minLevel: "A1",
    setting: "A stall at the Mercado de Medellín in Mexico City on a Saturday morning.",
    tutorRole: "A talkative marchanta at a fruit and vegetable stall.",
    learnerRole: "A shopper buying ingredients for salsa and dinner.",
    goals: [
      "Ask for three different items by name and quantity (kilos, piezas)",
      "Ask how much something costs in pesos and respond to the price",
      "Pay, ask for a bolsa, and say goodbye politely",
    ],
  },
  {
    id: "es-directions",
    language: "es",
    title: "Asking for directions",
    description: "Find your way to the Zócalo by asking a stranger for directions and using the Metro.",
    minLevel: "A1",
    setting: "Outside Metro Bellas Artes in Mexico City; you are lost on your way to the Zócalo.",
    tutorRole: "A helpful chilango passerby who knows the Centro Histórico well.",
    learnerRole: "A visitor trying to reach the Zócalo on foot or by Metro.",
    goals: [
      "Politely stop someone and ask where the Zócalo is",
      "Understand directions with left, right, straight ahead, and which Metro line to take",
      "Confirm how long it takes to get there and thank them",
    ],
  },
  {
    id: "es-pharmacy",
    language: "es",
    title: "At the pharmacy",
    description: "Describe mild symptoms to a pharmacist and get the right remedy.",
    minLevel: "A2",
    setting: "A quiet Farmacias Similares branch in Coyoacán in the afternoon.",
    tutorRole: "A patient pharmacist who asks follow-up questions.",
    learnerRole: "A customer with a headache and a sore throat.",
    goals: [
      "Describe your symptoms and how long you have had them",
      "Understand the pharmacist's advice and dosage instructions",
      "Ask whether you need a receta and how much it costs in pesos",
    ],
  },
  {
    id: "es-neighbor",
    language: "es",
    title: "Meeting a new neighbor",
    description: "Introduce yourself to a neighbor and make small talk about the building and the area.",
    minLevel: "A2",
    setting: "The hallway of an apartment building in Colonia Condesa; you have just moved in.",
    tutorRole: "A warm, curious neighbor who has lived in the building for years.",
    learnerRole: "A newcomer who moved to Mexico City last week.",
    goals: [
      "Introduce yourself and say where you are from and what you do",
      "Ask about the colonia: tianguis, the nearest Metro or Metrobús, and quiet hours",
      "Accept or decline an invitation for a café and arrange a time",
    ],
  },
  {
    id: "es-hotel",
    language: "es",
    title: "Checking into a hotel",
    description: "Check in, ask about hotel services, and resolve a small problem with your room.",
    minLevel: "A2",
    setting: "The reception desk of a mid-range hotel in Oaxaca's centro in the evening.",
    tutorRole: "A professional receptionist handling check-in.",
    learnerRole: "A traveler with a reservation for two nights.",
    goals: [
      "Confirm your reservation and provide your details",
      "Ask about breakfast, Wi-Fi, checkout time, and the price in pesos",
      "Report that the room's air conditioning is not working and ask for a fix",
    ],
  },
  {
    id: "es-job-interview",
    language: "es",
    title: "A job interview",
    description: "Talk about your experience, strengths, and goals in a short job interview.",
    minLevel: "B1",
    setting: "A meeting room at a small company in Monterrey; a first-round interview.",
    tutorRole: "A hiring manager asking standard interview questions.",
    learnerRole: "A candidate applying for a role in your own field.",
    goals: [
      "Summarize your background and current role",
      "Describe a challenge you solved and what you learned",
      "Ask two questions about the team and next steps",
    ],
  },
  {
    id: "es-carne-asada",
    language: "es",
    title: "A backyard carne asada",
    description: "Join a friend's family carne asada, meet the tíos and help out at the grill.",
    minLevel: "A2",
    setting: "A Sunday carne asada in a backyard in East San José, California, with music, a cooler of drinks and kids running around. Casual, warm register: tú, ustedes, Mexican slang welcome.",
    tutorRole: "Your friend's tío at the grill, joking around and making sure everyone eats.",
    learnerRole: "A friend of the family at their first carne asada with them.",
    goals: [
      "Introduce yourself and say how you know the family",
      "Offer to help and ask what you can bring or do",
      "Compliment the food and ask how the carne is marinated",
    ],
  },
  {
    id: "es-coworker",
    language: "es",
    title: "Chatting with a coworker",
    description: "Small talk on break with a coworker who speaks Spanish at home.",
    minLevel: "A2",
    setting: "The break room of an office in Fresno, California, on a Monday morning. Relaxed coworker register: tú, everyday Mexican-American Spanish.",
    tutorRole: "A friendly coworker from Michoacán who grew up in the Central Valley.",
    learnerRole: "A coworker trying out their Spanish for the first time at work.",
    goals: [
      "Ask how their weekend was and share what you did",
      "Talk about your work and the week ahead",
      "Make plans to grab lunch together",
    ],
  },
  {
    id: "es-la-taqueria",
    language: "es",
    title: "At a taquería in LA",
    description: "Order at a busy East LA taquería, ask about the salsas and chat with the taquero.",
    minLevel: "A2",
    setting: "A busy taquería on Cesar Chavez Avenue in East Los Angeles on a Friday night, prices in dollars. Casual counter register: tú, quick back-and-forth.",
    tutorRole: "A fast, good-humoured taquero who loves recommending the house specials.",
    learnerRole: "A customer ordering dinner for themselves and a friend.",
    goals: [
      "Order tacos and a drink for two, with or without cebolla y cilantro",
      "Ask which salsa is the spiciest and what the specials are",
      "Ask for the total in dollars, pay and say thanks",
    ],
  },
  {
    id: "es-soccer-game",
    language: "es",
    title: "Watching the game",
    description: "Watch a Liga MX match with friends and talk fútbol, teams and plays.",
    minLevel: "A2",
    setting: "A friend's living room in Santa Ana, California, during a Chivas vs. América match. Loud, casual register: tú, fútbol slang, lots of reactions.",
    tutorRole: "A passionate Chivas fan who explains everything happening on screen.",
    learnerRole: "A friend watching the match with the group.",
    goals: [
      "Say which team you support and why",
      "React to a goal, a foul or a missed chance",
      "Make a prediction about the final score",
    ],
  },
  {
    id: "es-friends-family",
    language: "es",
    title: "Meeting a friend's family",
    description: "Have dinner with a friend's parents and talk about family, work and where everyone is from.",
    minLevel: "B1",
    setting: "A family dinner at your friend's parents' house in Riverside, California, with pozole on the table. Casual but respectful register: ustedes with the parents, tú with your friend.",
    tutorRole: "Your friend's mom, curious and warm, who moved from Jalisco in the nineties.",
    learnerRole: "Your friend's close friend, meeting the family for the first time.",
    goals: [
      "Tell the story of how you and your friend met",
      "Ask about the family's hometown and how they came to California",
      "Thank her for dinner and accept or decline seconds politely",
    ],
  },
  {
    id: "es-texting-slang",
    language: "es",
    title: "Making plans with slang",
    description: "Make weekend plans with a friend the way people actually talk: güey, qué onda, ¿jalas?",
    minLevel: "B1",
    setting: "A voice-note conversation with a friend in Sacramento, California, planning Saturday night. Very casual register: Mexican slang, short sentences, playful teasing.",
    tutorRole: "A laid-back friend who talks fast and uses plenty of Mexican slang.",
    learnerRole: "A friend figuring out the weekend plan.",
    goals: [
      "Understand and answer slang greetings like qué onda and ¿qué hubo?",
      "Suggest a plan and ask if they're in (¿jalas?)",
      "Agree on a time and place, and who's driving",
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
  let units = 0;
  for (const file of loadAllContent()) {
    for (const { id, order, title, canDo, pattern, targetWords, modelSentences, scenarioHint } of file.units) {
      const data = {
        language: UNIT_LANGUAGE,
        dialect: UNIT_DIALECT,
        level: file.level,
        order,
        title,
        canDo,
        pattern,
        targetWords,
        modelSentences,
        scenarioHint: scenarioHint ?? null,
      } satisfies Omit<Prisma.UnitUncheckedCreateInput, "id">;
      await db.unit.upsert({ where: { id }, create: { id, ...data }, update: data });
      units++;
    }
  }
  console.log(`Seeded ${languages.length} languages, ${scenarios.length} scenarios and ${units} units.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

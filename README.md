# Wafel

A personal real-time voice language tutor. Browser app (Next.js, Vercel) talks to a
Python LiveKit agent running OpenAI GPT-Live. Progress syncs across devices through
Prisma Postgres.

- `web/` — Next.js app (bun)
- `agent/` — LiveKit agent (uv)

## Setup (web)

Requires [bun](https://bun.sh) and the Vercel CLI (`vercel login`, team `northlight`).

```sh
cd web
bun install
vercel link --yes --project wafel --scope northlight
vercel env pull .env.local --environment development   # DATABASE_URL etc.
bun run db:migrate                                      # prisma migrate dev
bun run db:seed                                         # languages + scenarios
bun run dev
```

Other scripts: `bun run test` (Vitest), `bun run lint`, `bun run build`,
`bun run db:studio`. See `web/.env.example` for every variable the app reads.

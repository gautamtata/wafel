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
bun install                                             # also runs prisma generate
vercel link --yes --project wafel --scope northlight
vercel env pull .env.local --environment development   # DATABASE_URL etc.
# (without Vercel: cp .env.example .env.local and fill in DATABASE_URL)
bun run db:migrate                                      # prisma migrate dev
bun run db:seed                                         # languages + scenarios
bun run dev
```

Other scripts: `bun run test` (Vitest), `bun run lint`, `bun run build`,
`bun run db:studio`. See `web/.env.example` for every variable the app reads.

The test suite writes rows (prefixed `test-`) to a database. Because the Prisma
integration injects the production `DATABASE_URL` into every environment, the
DB-backed suites are skipped unless you set `DATABASE_URL_TEST` to a dedicated test
database in `web/.env.local`, or opt in explicitly with
`WAFEL_ALLOW_SHARED_DB_TESTS=1` to run them against `DATABASE_URL`.

## Setup (agent)

See `agent/README.md` (`uv sync`, `uv run python -m wafel_agent.main dev`).

## Deployment

Production is https://wafel-mocha.vercel.app (Vercel project `wafel`, team
`northlight`, root `web`). The tutor runs on LiveKit Cloud Agents as `wafel-tutor`.

### Web (Vercel)

Pushing `main` deploys production automatically. To deploy by hand from the repo root:

```sh
vercel link --yes --scope northlight --project wafel   # once
vercel deploy --prod
```

Migrations are not run by the build. After a schema change:

```sh
cd web && bunx prisma migrate deploy && bun run db:seed   # seed is idempotent
```

The Prisma Postgres integration injects one `DATABASE_URL` into Production, Preview
and Development, so every environment shares the same database.

### Agent (LiveKit Cloud)

`lk` reads the LiveKit project from `LIVEKIT_URL` / `LIVEKIT_API_KEY` /
`LIVEKIT_API_SECRET` (or `lk project add`). From `agent/`:

```sh
# first time: creates the agent and writes agent/livekit.toml (committed)
lk agent create --region us-east --secrets-file .env.production
# updates
lk agent deploy
lk agent update-secrets --secrets-file .env.production   # after rotating a secret
lk agent status && lk agent logs
```

`agent/.env.production` (gitignored) holds `OPENAI_API_KEY`, `WAFEL_API_URL` (the
production URL) and `AGENT_SHARED_SECRET`. Never set `WAFEL_SAMPLE_BRIEF` in production.

### Environment variables

| Variable | Web (Vercel) | Agent | Notes |
|---|---|---|---|
| `DATABASE_URL` | prod, preview, dev | | injected by the Prisma Postgres integration |
| `APP_PASSPHRASE` | prod, preview | | the single login passphrase |
| `APP_SECRET` | prod, preview | | signs the session cookie (32 random bytes, hex) |
| `APP_TIME_ZONE` | prod, preview | | IANA zone for streaks (`America/Los_Angeles`) |
| `AGENT_SHARED_SECRET` | prod, preview | yes | must match on both sides |
| `OPENAI_API_KEY` | prod, preview | yes | recap model (web), GPT-Live (agent) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | prod, preview | injected by LiveKit Cloud | room creation, dispatch, tokens |
| `NEXT_PUBLIC_LIVEKIT_URL` | prod, preview | | same value as `LIVEKIT_URL`, read by the browser |
| `WAFEL_API_URL` | | yes | base URL the agent posts to |

Add or change a web variable with `vercel env add NAME production < file` (repeat for
`preview`), then redeploy. Values are never committed.

### Changing the passphrase

```sh
printf '%s' 'new-four-word-passphrase' > /tmp/pass
vercel env rm APP_PASSPHRASE production -y && vercel env add APP_PASSPHRASE production < /tmp/pass
vercel env rm APP_PASSPHRASE preview -y && vercel env add APP_PASSPHRASE preview < /tmp/pass
rm /tmp/pass && vercel deploy --prod
```

Existing cookies stay valid (they are signed with `APP_SECRET`); rotate `APP_SECRET`
the same way to log every device out.

### Rotate keys when done

The OpenAI and LiveKit keys used during development were handled in the open on a
developer machine. When the project is finished (or if a key may have leaked), rotate
them in the OpenAI dashboard and LiveKit Cloud, update the Vercel env and
`agent/.env.production`, run `lk agent update-secrets --secrets-file .env.production`,
and redeploy both sides. Regenerate `APP_SECRET` and `AGENT_SHARED_SECRET` with
`openssl rand -hex 32`.

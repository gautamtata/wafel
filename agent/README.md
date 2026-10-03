# wafel-agent

LiveKit agent that runs the Wafel Spanish tutor on OpenAI GPT-Live.

## Setup

```sh
cd agent
cp .env.example .env   # fill in keys
uv sync
```

## Run

```sh
uv run python -m wafel_agent.main console   # local mic/speaker, uses WAFEL_SAMPLE_BRIEF
uv run python -m wafel_agent.main dev       # connect to LiveKit Cloud, hot reload
uv run python -m wafel_agent.main start     # production worker
```

The worker registers as agent `wafel-tutor` (override with `WAFEL_AGENT_NAME`, e.g.
`wafel-tutor-dev`, so a local `dev` worker does not compete with the deployed one for
dispatches; the web app only dispatches `wafel-tutor`). The web app dispatches it with job
metadata `{"sessionId": "<id>"}`; the agent fetches the brief from
`WAFEL_API_URL/api/agent/sessions/<id>/brief` using `X-Agent-Secret`. If the fetch
fails the agent posts `failed` and shuts down. When a job carries no `sessionId`
(console mode or a manual dispatch) and `WAFEL_SAMPLE_BRIEF` is set, the agent runs
with that sample brief instead (API writes then fail gracefully and are logged).
`WAFEL_SAMPLE_BRIEF` is dev-only; leave it unset in production.

## Test

```sh
uv run pytest
uv run ruff check
```

## Deploy (LiveKit Cloud Agents)

```sh
# create .env.production (gitignored) containing ONLY:
#   OPENAI_API_KEY=...
#   WAFEL_API_URL=https://wafel-mocha.vercel.app
#   AGENT_SHARED_SECRET=...   (same value as the Vercel env)
lk agent create --region us-east --secrets-file .env.production   # first time; commits livekit.toml
lk agent deploy                                                   # ship a new build
lk agent update-secrets --secrets-file .env.production            # after rotating a secret
lk agent status && lk agent logs
```

LiveKit Cloud injects `LIVEKIT_URL`/`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET` into the
deployed worker; do not put them (or WAFEL_SAMPLE_BRIEF) in `.env.production`, and do not copy
`.env.example` there: empty values make `lk agent create` fail. See the
root README for the full deployment runbook.

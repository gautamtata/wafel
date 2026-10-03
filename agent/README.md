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

The worker registers as agent `wafel-tutor`. The web app dispatches it with job
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
lk agent create      # first time, from agent/
lk agent secrets set --secrets-file .env
lk agent deploy
```

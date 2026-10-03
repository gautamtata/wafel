FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=never

WORKDIR /app

COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY wafel_agent ./wafel_agent
COPY sample_brief.json README.md ./
RUN uv sync --frozen --no-dev

RUN useradd -m appuser && chown -R appuser /app
USER appuser

CMD ["uv", "run", "python", "-m", "wafel_agent.main", "start"]

FROM ghcr.io/astral-sh/uv:python3.12-alpine

WORKDIR /opt/mtmon

# Install project dependencies using pyproject.toml with uv
COPY . /opt/mtmon/
RUN uv sync --no-dev

# Ensure the project's virtual environment is on PATH
ENV PATH="/opt/mtmon/.venv/bin:$PATH"

ENTRYPOINT ["/opt/mtmon/docker-entrypoint.sh"]

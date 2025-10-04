FROM ghcr.io/astral-sh/uv:python3.12-alpine

WORKDIR /opt/mtmon

# Install project dependencies using pyproject.toml with uv
COPY pyproject.toml /opt/mtmon/pyproject.toml
RUN uv sync --no-dev

# Copy application source
COPY . /opt/mtmon/

# Ensure the project's virtual environment is on PATH
ENV PATH="/opt/mtmon/.venv/bin:$PATH"

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]

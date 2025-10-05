## Meshtastic Monitor (mtmon)

Meshtastic Monitor is a real‑time network observability app for Meshtastic. It ingests MQTT traffic, stores useful metadata, and gives you a live view of nodes, packets, links, and usage patterns.

- Backend: FastAPI (REST + WebSocket), MQTT ingest, SQLite
- Frontend: React 19, Vite, TailwindCSS

### Features

- Live packet stream: See packets as they arrive, including hop and gateway observations.
- Node directory: Browse nodes with last‑seen info, roles, telemetry, and metrics.
- Interactive map: Visualize node locations and direct links, with direction and recency cues.
- Link insights: Derive direct links from gateway hears, NeighborInfo, and Traceroute data.
- Stats and trends: Identify noisy nodes, view port type distribution, and filter by date range.
- Multi‑gateway awareness: Filter views by gateway to focus on a specific coverage area.

### How it works (high‑level)

1. Subscribe to your MQTT broker’s Meshtastic topic (e.g. `msh/#`).
2. Parse `ServiceEnvelope` payloads and extract packet metadata.
3. Enrich and persist nodes, gateways, packets, and link observations in SQLite.
4. Broadcast new packet data over WebSocket for immediate UI updates.

The ingest pipeline handles common Meshtastic apps, including NodeInfo, Position, Telemetry, NeighborInfo, Traceroute, and Text Messages. Encrypted payloads are attempted to be decoded with a default key when possible.

## Quick start

### 1) Backend (FastAPI)

Requirements:
- Python 3.12+
- `uv` (via `pipx install uv` or `pip install uv`)
- An MQTT broker with Meshtastic envelopes (e.g., Mosquitto)

Run locally:

```bash
cd backend
uv sync
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

- API docs: `http://localhost:8000/docs`
- Default DB path: `data/nodes.db` (relative to where you run the app)

Environment variables (defaults shown):

```bash
export MQTT_BROKER=mosquitto
export MQTT_PORT=1883
export MQTT_USERNAME=mt
export MQTT_PASSWORD=""
export ROOT_TOPIC=msh/EU_868/2/e/LongFast/
export CORS_ALLOW_ORIGINS="*"
export DB_PATH="data/nodes.db"
```

Container image (backend): A `Dockerfile` is available under `backend/` for running the API service.

### 2) Frontend (React + Vite)

Requirements:
- Node.js 22+
- pnpm (via Corepack)

Install deps:

```bash
cd frontend
corepack pnpm install
```

Development options:
- Proxy to local backend (recommended):

  ```bash
  # in frontend/
  printf "API_PROXY_TARGET=http://localhost:8000\n" > .env.local
  corepack pnpm dev
  ```

  The dev server runs at `http://localhost:5173` and proxies `/api` and WS to the backend (see `frontend/vite.config.ts`).

- Direct URL without proxy:

  ```bash
  # in frontend/
  printf "VITE_API_BASE_URL=http://localhost:8000\n" > .env.local
  corepack pnpm dev
  ```

Build & preview:

```bash
cd frontend
corepack pnpm build
corepack pnpm preview
```

Frontend configuration:
- `VITE_API_BASE_URL` (default `"/api"`) — used by `frontend/src/lib/config.ts`
- When using a full URL, ensure backend CORS allows your frontend origin

## Core capabilities

- Nodes API and map overlay: Nodes are enriched with `NodeInfo`, `Position` and `Telemetry` (battery, air util, channel util, etc.) and associated with gateways that heard them.
- Link detection: Direct links are inferred from gateway hears and augmented with NeighborInfo and Traceroute observations. Links are directional when evidence is unidirectional.
- Packets and hops: Each packet is associated with a set of “hops” (gateway observations with hop counts, RSSI/SNR) so you can reconstruct how and where it was heard.
- Stats: Aggregations like port type counts and “noisy nodes” are exposed over REST and rendered in the UI with a shared date‑range filter.
- Real‑time updates: The UI subscribes to a WebSocket channel to show new packets without refresh.

## Git hooks

This repo includes a `pre-commit` hook at `.githooks/pre-commit` that formats and lints changed files (backend via Ruff, frontend via Prettier/ESLint).

Enable for this repo:

```bash
git config core.hooksPath .githooks
```

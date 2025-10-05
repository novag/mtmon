# Meshtastic Monitor Backend

A FastAPI service that ingests Meshtastic MQTT traffic, stores aggregated data in SQLite, and exposes REST endpoints and WebSockets for the frontend.

- Ingests MQTT messages from a Meshtastic broker and decodes payloads
- Persists nodes, packets, gateways, hops, and derived direct links in SQLite
- Serves REST APIs for nodes, packets, and stats
- Streams live packets via WebSocket for the UI

## Requirements
- Python 3.12+
- An MQTT broker with Meshtastic service envelopes (e.g., Mosquitto)
- Optional: Docker

## Quick Start (uv + Uvicorn)
```bash
uv sync
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000
```
- API docs: http://localhost:8000/docs
- The default database path is `data/nodes.db` relative to where you run the app. Ensure that directory exists or set `DB_PATH`.

Alternatively, using the FastAPI CLI:
```bash
uv run fastapi dev backend.main:app --host 0.0.0.0 --port 8000
```

## Configuration
The backend reads configuration from environment variables with sensible defaults. See `backend/backend/main.py` and `backend/backend/db.py`.

- MQTT (env)
  - `MQTT_BROKER` — default: `mosquitto`
  - `MQTT_PORT` — default: `1883`
  - `MQTT_USERNAME` — default: `mt`
  - `MQTT_PASSWORD` — default: empty
  - `ROOT_TOPIC` — default: `msh/EU_868/2/e/LongFast/`
- CORS (env)
  - `CORS_ALLOW_ORIGINS` (comma-separated). Default: `*`
- Database
  - Default: `DB_PATH=data/nodes.db` (relative path). WAL mode enabled.

Example (local):
```bash
export MQTT_BROKER=localhost
export MQTT_PORT=1883
export MQTT_USERNAME=mt
export MQTT_PASSWORD=changeme
export ROOT_TOPIC=msh/EU_868/2/e/LongFast/
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

Notes:
- For local development, point `MQTT_BROKER` to your Mosquitto host.

## API Overview
OpenAPI docs are available at `/docs` and `/redoc` when the server is running.

Key routes:
- `GET /gateways` — recent gateways (last 30 days by default)
- `GET /nodes?gateway_id&from_date` — nodes with computed 24h rates
- `GET /packets/{packet_id}` — packet by ID
- `GET /nodes/{node_id}/packets?filter_mode&start_date&end_date` — packets by node with modes: `sent_by|sent_to|received`
- `GET /stats/portnums?node_id&start_time&end_time` — counts per port name
- `GET /stats/nodes?portnum&start_time&end_time` — top noisy nodes
- `GET /links/direct` — direct, directed links seen in the last 24h

WebSocket:
- `GET /ws?gateway_id=<int>` — live packet stream; omit `gateway_id` to receive all

## WebSocket Usage Example
```bash
# All gateways
websocat ws://localhost:8000/ws

# Filter by a specific gateway id (decimal)
websocat "ws://localhost:8000/ws?gateway_id=12345678"
```

## Data Model (SQLite)
Tables (see `backend/backend/models.py`):
- `gateways` — known gateways
- `nodes` — known nodes, plus `position`, `metrics`, and `info` JSON blobs
- `packets` — unique packet tuple `(id, from_id, to_id)` with first seen and metadata
- `packet_gateway_links` — which gateways heard which packets, with RSSI/SNR/hop
- `gateway_node_links` — which gateways observed which nodes, with RSSI/SNR
- `direct_links` — derived directed links with last seen, SNR/RSSI and source


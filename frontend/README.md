# Meshtastic Monitor Frontend

A React 19 + Vite application for visualizing Meshtastic network activity. It consumes the mtmon backend's REST and WebSocket APIs.

- React 19 with SWC, TypeScript, and TailwindCSS
- Charts, tables, maps, and live packet stream views

## Requirements

- Node.js 22+
- pnpm (managed via Corepack) — see `package.json`'s `packageManager`

## Install

```bash
corepack pnpm install
```

## Development

```bash
corepack pnpm dev
```

- Opens Vite dev server on http://localhost:5173 by default
- Proxies API requests via `/api` when `API_PROXY_TARGET` (or `VITE_API_PROXY_TARGET`) is set (see `vite.config.ts`)
- WebSocket proxying is enabled (`ws: true`) when the proxy is active

## Build & Preview

```bash
corepack pnpm build
# Static assets in dist/
corepack pnpm preview  # serves the built app locally
```

## Environment Configuration

The frontend reads its backend base URL from `VITE_API_BASE_URL` at build/runtime:

- Default: `"/api"` (relative), which leverages the Vite dev server proxy for local dev
- WebSocket base URL mirrors `VITE_API_BASE_URL` with `ws` scheme

Create a `.env.local` for development overrides:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8000
```

If you set an absolute `VITE_API_BASE_URL`, make sure CORS on the backend allows your frontend origin.

Relevant code:

- `src/lib/config.ts` builds REST and WS URLs
- `vite.config.ts` defines an `/api` proxy to a remote or local backend

### Connect Dialog Configuration

The Connect dialog content can be customized via environment variables. Add these to `.env.local` (or your deployment env):

```bash
# Mesh/location label shown in the Important Note section
VITE_CONNECT_MESH_LOCATION="Munich"

# MQTT bridge parameters used in the sample mosquitto config blocks
VITE_CONNECT_MQTT_ADDRESS="mqtt.example.org:1883"
VITE_CONNECT_MQTT_USERNAME="mt_pub"
VITE_CONNECT_MQTT_PASSWORD="mtmon"
```

If omitted, the UI falls back to the values shown above. These values are interpolated into the example `bridge.conf` snippets and the location text in `src/layouts/MenuLayout.tsx`.

## Connecting to the Backend

- Local backend at `http://localhost:8000`:
  - Option A (recommended in dev): keep `VITE_API_BASE_URL=/api` and set `API_PROXY_TARGET=http://localhost:8000` (or `VITE_API_PROXY_TARGET`) in `.env.local`
  - Option B: set `VITE_API_BASE_URL=http://localhost:8000`
- Remote backend:
  - Set `VITE_API_BASE_URL=https://your.backend.example`

Proxy target is configured via env in `vite.config.ts` (set `API_PROXY_TARGET` or `VITE_API_PROXY_TARGET`). The proxy is only enabled if a target is provided.

## Scripts

- `pnpm dev` — start dev server
- `pnpm build` — type-check and build
- `pnpm preview` — serve built `dist`
- `pnpm lint` — run ESLint
- `pnpm format` — run Prettier

## Deployment

- Any static host that serves `dist/` works (Vercel, Netlify, Nginx, etc.)
- Configure the runtime to forward `/ws` and `/api` (if using relative paths) to the backend, or bake absolute URLs via `VITE_API_BASE_URL`
- For `vercel.json`, ensure rewrites/proxies route `/api` and `/ws` appropriately to your backend
- On CI or Vercel, set `PACKAGE_MANAGER=pnpm` or let Corepack read `packageManager`.

## Copilot / AI Agent Instructions for GaiaLab

Purpose: Help an AI coding agent be immediately productive in this repo.

- **Big picture**: This is a stateless MCP HTTP server (`src/server.js`) that synthesizes biological data (UniProt, KEGG, PubMed, STRING) via small integration clients in `src/data/integrations/` and aggregator modules in `src/data/aggregators/`. AI synthesis lives in `src/ai/models/insight-generator.js`. The UI is a single widget served from `public/gaialab-widget.html`.

- **How to run (dev/prod)**:
  - Install: `npm install`
  - Dev (auto-reload): `npm run dev` (uses `nodemon` and watches `src/` + `public/`)
  - Prod: `npm start` → runs `node src/server.js`
  - Environment: copy `.env.example` → `.env` and set at least one AI key (see `CLAUDE.md`).

- **Key endpoints / behavior**:
  - MCP entrypoint: POST/GET `/mcp` handled by `src/server.js` (input schema validated with `zod`).
  - The server registers a single tool `gaialab_generate_insights` and a resource `gaialab-widget` that returns `public/gaialab-widget.html`.

- **Project-specific patterns**:
  - Data pipeline uses a 3-phase flow: parallel fetch (Promise.all) → AI synthesis → format for widget. Look at `buildRealGaiaBoard()` in `src/server.js` for the canonical pattern.
  - Aggregators return normalized objects consumed by the AI layer. Follow existing aggregator interfaces when adding sources (see `gene-aggregator.js`, `pathway-aggregator.js`).
  - Caching: in-memory cache via `src/utils/result-cache.js`; check `resultCache.get()`/`set()` usage before re-querying remote APIs.
  - Audience-driven prompts: `audience` enum in `src/server.js` adjusts prompt templates; mirror this when updating prompt engineering code.

- **Where to look for common tasks**:
  - Add new integration: `src/data/integrations/*` and wire into `src/data/aggregators/*` and `buildRealGaiaBoard()`.
  - Tweak AI synthesis: `src/ai/models/insight-generator.js` (prompt builders, validate/format functions).
  - Widget changes: `public/gaialab-widget.html` (render functions and styles).
  - 3D network data formatting: `src/visualization/network-formatter.js`.

- **Developer workflows & debugging tips**:
  - Reproduce slow calls by adding console.time/timeEnd logs around aggregator calls in `buildRealGaiaBoard()`.
  - Use `.env` keys to toggle providers (e.g., skip `includeDrugs` for faster runs).
  - For local quick feedback, use small gene lists (1–5 symbols) to keep API calls fast and avoid rate limits.

- **Safety / data expectations**:
  - The code insists on citation-backed outputs (see literature aggregation + citation counts). Don't remove citation checks in the AI validation step.
  - Treat outputs as research-only; the repo contains prominent disclaimers; preserve those in UI and API responses.

- **Examples (copy/paste snippets)**:
  - Start server: `npm start` (runs `node src/server.js`)
  - Input schema snippet (zod-based) lives at top of `src/server.js` and must be respected when calling tools.

- **Files to cite when making changes**:
  - `src/server.js` — main MCP server & `buildRealGaiaBoard()`
  - `src/ai/models/insight-generator.js` — AI prompt + synthesis
  - `src/data/aggregators/*` — aggregator interfaces and enrichment logic
  - `src/data/integrations/*` — HTTP clients for external APIs
  - `public/gaialab-widget.html` — UI + rendering functions

If anything here seems unclear or you need additional examples (tests, common input shapes, or sample `.env` values), tell me which area to expand.

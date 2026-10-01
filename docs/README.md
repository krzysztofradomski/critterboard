# Critterboard docs

#index

Architecture notes, decisions, and module guides. Written for skimming in Obsidian — short paragraphs, mermaid diagrams, `[[wiki-links]]` between related pages.

## Map of contents

| Doc | What's inside |
|---|---|
| [[handoff]] | **Start here locally** — what to run on your Mac to finish the app: simulator, iPhone, map spike, Cloudflare, store. |
| [[architecture]] | App map — folders, native modules, network touchpoints, top-level diagram. |
| [[ml-roadmap]] | On-device ML plan — MVP, full training, deferred placeholders. The master "what's next". |
| [[../NOTICE|NOTICE]] | Licences of the models, photos and icons (the MIT `LICENSE` covers code only). |
| [[deployment]] | Shipping to iOS TestFlight & Google Play via EAS — build profiles, credentials, submit config. |
| [[i18n]] | i18n architecture — bundled JSON packs, `t()` helper, remote OTA pack manifest, App Store notes. |
| [[modules/responsive-layout-shell]] | Global centered app-shell with `maxWidth` so all screens render cleanly on larger displays. |
| [[modules/permissions-web]] | Camera is "recommended, not required" on web — explains why mobile Safari can't prompt over HTTP and how the gallery-picker fallback covers it. |
| [[modules/crash-reporting]] | Opt-in Sentry wrapper — toggle, DSN config, graceful degradation, what we send. |
| [[modules/backend-adapter]] | Backend adapter seam — mock today, Cloudflare Workers tomorrow. Schemas, hooks, privacy gating. |
| [[modules/offline-map]] | Offline 2D map — MapLibre Native + local PMTiles packs, sticker style, download-once flow. |
| [[modules/species-icons]] | Photo-based sticker icons per species — how they are made (attention map + SAM), shipped as one atlas with the pack, emoji fallback. |
| [[decisions/001-crash-reporting-opt-in]] | ADR — why crash reporting is opt-in and why Sentry. |
| [[decisions/002-backend-adapter-seam]] | ADR — single adapter seam for leaderboard / friends / feed, targeting Cloudflare Workers. |
| [[decisions/004-remove-cloud-gemini]] | ADR — why the cloud Gemini fallback was removed; what scan and chat do instead. |
| [[decisions/005-gemma-4-only-chat]] | ADR — chat runs only on Gemma 4 E2B (Apache 2.0); no scripted fallback, no web chat; alternatives considered. |
| [[decisions/003-offline-map-maplibre-pmtiles]] | ADR — why an offline MapLibre + PMTiles map instead of Leaflet or the globe. |

## Conventions

- One `.md` per significant module or surface. Empty files aren't pre-created — add them when there's something to say.
- ADRs go in `docs/decisions/NNN-<slug>.md` as the "why" record for non-obvious calls.
- Architecture diagrams use mermaid fences so they render in GitHub and Obsidian both.
- Tag pages with `#tags` (e.g. `#architecture`, `#data-model`) so Obsidian's graph view clusters them.
- Edit existing docs in place rather than appending new ones for the same surface; update this index when adding a page.

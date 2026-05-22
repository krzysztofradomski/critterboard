# Critterboard docs

#index

Architecture notes, decisions, and module guides. Written for skimming in Obsidian — short paragraphs, mermaid diagrams, `[[wiki-links]]` between related pages.

## Map of contents

| Doc | What's inside |
|---|---|
| [[ml-roadmap]] | On-device ML plan — MVP, full training, deferred placeholders. The master "what's next". |
| [[i18n]] | i18n architecture — bundled JSON packs, `t()` helper, remote OTA pack manifest, App Store notes. |
| [[modules/responsive-layout-shell]] | Global centered app-shell with `maxWidth` so all screens render cleanly on larger displays. |
| [[modules/chat-gemini-poc]] | AI SDK chat adapter with Gemini cloud fallback as a temporary proof-of-concept. |
| [[modules/crash-reporting]] | Opt-in Sentry wrapper — toggle, DSN config, graceful degradation, what we send. |
| [[modules/backend-adapter]] | Backend adapter seam — mock today, Cloudflare Workers tomorrow. Schemas, hooks, privacy gating. |
| [[decisions/001-crash-reporting-opt-in]] | ADR — why crash reporting is opt-in and why Sentry. |
| [[decisions/002-backend-adapter-seam]] | ADR — single adapter seam for leaderboard / friends / feed, targeting Cloudflare Workers. |

## Conventions

- One `.md` per significant module or surface. Empty files aren't pre-created — add them when there's something to say.
- ADRs go in `docs/decisions/NNN-<slug>.md` as the "why" record for non-obvious calls.
- Architecture diagrams use mermaid fences so they render in GitHub and Obsidian both.
- Tag pages with `#tags` (e.g. `#architecture`, `#data-model`) so Obsidian's graph view clusters them.
- Edit existing docs in place rather than appending new ones for the same surface; update this index when adding a page.

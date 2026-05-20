# Critterboard docs

#index

Architecture notes, decisions, and module guides. Written for skimming in Obsidian — short paragraphs, mermaid diagrams, `[[wiki-links]]` between related pages.

## Map of contents

| Doc | What's inside |
|---|---|
| [[ml-roadmap]] | On-device ML plan — MVP, full training, deferred placeholders. The master "what's next". |
| [[i18n]] | i18n architecture — bundled JSON packs, `t()` helper, remote OTA pack manifest, App Store notes. |

## Conventions

- One `.md` per significant module or surface. Empty files aren't pre-created — add them when there's something to say.
- ADRs go in `docs/decisions/NNN-<slug>.md` as the "why" record for non-obvious calls.
- Architecture diagrams use mermaid fences so they render in GitHub and Obsidian both.
- Tag pages with `#tags` (e.g. `#architecture`, `#data-model`) so Obsidian's graph view clusters them.
- Edit existing docs in place rather than appending new ones for the same surface; update this index when adding a page.

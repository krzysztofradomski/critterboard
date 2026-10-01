# ADR 006 — Fresh start: no seeded user data, no invented people

`#decision` `#data-model` `#ux`

## Context

The prototype pre-filled the app so every screen looked busy: 7 caught species, a 35-day catch history, quest progress, a completed-quests list, eight demo map sightings, a leaderboard of invented trainers, a friends graph, and a credits screen with a made-up team. Testing on a clean simulator showed the cost: a new user opens the app and sees someone else's life. It also made real states (empty dex, no friends, no pins) untested.

## Decision

- A new install starts **empty**: dex, catch log, activity feed, quest progress, followed list. Onboarding asks for a trainer name (optional; falls back to "you").
- **No invented people.** `LEADERS`, `FRIENDS`, `PERSON_PROFILES`, `INITIAL_FOLLOWED` only contain data behind `EXPO_PUBLIC_DEMO_PEERS=1` (dev demos). Without the flag only the user's own leaderboard slot exists; screens show "nobody to race yet" instead of a podium.
- **No demo map sightings.** The Map shows the user's own pins only, with an empty-state card.
- Facts shown in the UI come from one source: the vision model's name/id/size from `data/visionModel.ts`, the app version from `app.json`, regions from `packs/manifest.json` (a test keeps `AVAILABLE_REGION_IDS` in sync; other regions are greyed out as "soon").
- **Local location ≠ sharing.** The OS location permission drives the private map (centre, own pins). `profile.locationShareOn` only controls whether coordinates are *published*.

## Consequences

- Existing installs keep their persisted (seeded) state until the user wipes data in Settings or reinstalls.
- Empty states are now real UI and need to stay designed (Home, Dex, Quests, Leaderboard, Friends, Map, Activity).
- The mock backend returns an empty world by default; it is still useful with `EXPO_PUBLIC_DEMO_PEERS=1` for demos and for developing social screens before the Cloudflare backend is deployed.
- **One BugNet, one active region.** A region pack is the model + species list + label map + icons, installed together. Brains shows a single BugNet card containing the regions; exactly one installed region is *active* (persisted as `activeRegion`) and drives Scan. Installing a pack activates it; tapping another installed region switches to it. Species from every installed pack stay in the Dex.

Related: [[../modules/backend-adapter]], [[../modules/offline-map]], [[003-offline-map-maplibre-pmtiles]].

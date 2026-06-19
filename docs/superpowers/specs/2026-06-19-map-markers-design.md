---
tags: [design, map, markers]
---

# Map markers: real species + informative click-through

## Problem

The map's 8 sighting markers are decorative emoji (`🦋`, `✨`, `🌿`…) with no link
to a real species, so they carry no information and lead nowhere. Tapping one only
swaps the bottom card's emoji. Users want markers that (a) say which insect they are
and (b) open that insect when clicked.

## Decisions (brainstormed)

- **Marker data:** seed the 8 demo sightings with real `BUGS` ids (curated cluster).
- **Click behaviour:** tap → species card → explicit **"View insect →"** button →
  `result` screen (the app's canonical insect detail, used by Dex/Home/Activity).
- **Informative pins:** colour each marker by its species `bug.color`. The globe
  library renders coloured *pins*, not emoji sprites — so the emoji lives in the
  card, not on the sphere. Emoji-on-globe is out of scope (separate lib feature).

## Changes

### `src/data/sightings.ts`
`Sighting` becomes `{ x, y, bugId, size }` (drop free `bug` emoji). Seed 8 varied
Central-European species: `brim, lady, hcat, stag, bdam, rchf, gshb, harl`.

### `src/screens/mapGeo.ts`
- `MapMarkerMeta` sighting variant gains `bugId`.
- `UserPinData` gains `bugId`; `buildUserPins` sets it from the catch id.
- `buildGlobeMarkers` derives each sighting marker's `icon`/`label`/`color` from
  `findBug(bugId)` (per-species colour) and records `bugId` in meta.

### `src/screens/Map.tsx` + `Map.web.tsx`
- Sighting card shows: emoji, localized name (`bugName`), latin, rarity chip
  (`RARITY_COLOR` + `dex.filter.<rarity>`), `n× sightings · distance`.
- Replace the card's primary action with **"View insect →"** → `go('result', { id: bugId })`.
- User-pin card gains the same "View insect →" (keeps Remove + close).

### `assets/i18n/{en,pl}.json`
Add `map.viewInsect` ("View insect →" / "Zobacz owada →").

## Tests (`src/__tests__/unit/screens/mapGeo.test.ts`)
- every `SIGHTINGS.bugId` resolves via `findBug`.
- `buildGlobeMarkers`: sighting marker `color === findBug(bugId).color`; meta carries `bugId`.
- `buildUserPins`: pin carries `bugId` equal to the catch id.

## Out of scope (YAGNI)

Emoji-on-globe sprites, floating species labels, real distance maths.

# Session lessons

Patterns from corrections / refinements to avoid repeating.

## App Store concerns — explain before assuming

**Session**: localization OTA loader.

Mid-implementation the user asked "perhaps this is too complicated for MVP and will not be accepted into App Store with such an OTA loader?"

I'd built a full OTA pack loader without flagging the policy assumption first. The user reasonably worried about Apple 4.7.

**Rule for next time**: when building anything that touches remote code/content fetching for an iOS app, *up front*:

1. State the App Store policy reading explicitly (4.7 = executable code restricted, content/JSON is fine).
2. Cite the precedent (Duolingo, Slack, news apps all fetch JSON content).
3. Confirm the user actually wants the OTA capability, since the simpler bundle-only solution is half the code.

Don't bury this in implementation — it changes scope decisions.

## Translation packs: array vs nested object trade-off

Used `notes: ["...", "...", "..."]` in pack JSON for region notes. Initially typed `Dict` as `{ [k: string]: string | Dict }` which broke at JSON import.

**Rule**: when designing a recursive `Dict` type for translation packs, allow `string[]` as a leaf. Arrays are useful for ordered lists (notes, canned lines, tip series) where the consumer iterates by count. Resolver walks them via numeric string keys (`Array.isArray(cur) ? cur[Number(p)] : cur[p]`).

## Persona / data refactor sequence

When moving strings out of TS data files into JSON packs, the cleanest order is:

1. Author the en.json source-of-truth pack first.
2. Refactor data files (strip strings, keep IDs + numeric/visual fields).
3. Update consumers to use `t(key)` resolution.
4. Mirror packs into target languages.

Doing #4 before #2/#3 creates duplicate work because the key shapes change as you discover what consumers actually need.

# Spec items 2026-10-09 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (chosen: inline, one task at a time). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Implement every item of [[../specs/2026-10-09-name-it-yourself-and-training-contributions-design]], one at a time, each in its own commits so any one can be reverted.

**Architecture:** see the spec. This plan fixes the order, files, interfaces and tests per task. Code is designed test-first inside each task rather than written out here. That's a deliberate deviation from the writing-plans template, made to save effort on a long plan; the spec is the binding detail.

**Tech stack:** Expo / React Native (TypeScript, vitest), zustand store, Cloudflare Worker (D1, R2, KV), `llama.rn`, react-native-executorch, `expo-image-manipulator`, `react-native-gesture-handler` + `react-native-reanimated`, Python 3 tools.

**Spec:** `docs/superpowers/specs/2026-10-09-name-it-yourself-and-training-contributions-design.md`

## Global Constraints

- Branch `spec-2026-10-09`. Stage named files only, never `commit -a`. `docs/README.md` and `tasks/todo.md` carry another session's uncommitted edits.
- Every network call goes through `src/backend/hooks.ts` and is gated on `profile.networkOn` (`docs/modules/backend-adapter.md`).
- i18n in en/pl/de/es (`assets/i18n/*.json`), written natively per language. Non-English copy is shown to the user before it ships (`tasks/lessons.md`).
- Website pages under `website/public/` other than `index.html` are generated: edit `tools/website/*.py`, run `python3 tools/website/gen_site.py`, and commit sources and output together.
- Anything that changes the Cloudflare account (R2 bucket, D1 remote migration, secrets, deploy), any push, and any EAS build is prepared but run only when the user says so.
- Checks before each task's completion: `pnpm test`, `pnpm typecheck`, and for worker tasks `npm run smoke` in `worker/` where the local runtime allows.

## Review Focus

1. **A manual catch leaking into the leaderboard** through any path: publish, batch backfill, or local XP.
2. **Location or EXIF in a training upload** (camera photos carry GPS EXIF).
3. **Update swap leaves the user without a model** when the download or verification fails midway.
4. **Accent folding and Polish letters** in species search (ł doesn't decompose under NFD).
5. **Lightbox gestures on small screens:** panning past the edges, or closing while zoomed.

---

### Task 0: Worker species list (spec §3 step 0)
- Run `tools/worker/gen_species_xp.py`; `worker/src/speciesXp.ts` then has all 1,108 pack ids.
- Test: a check that every `packs/*.json` bug id is in `SPECIES_XP`. Add it to the app unit tests (`src/__tests__/unit/data/`), reading both files.
- Commit. Worker deploy is the user's.

### Task 1: Photo lightbox (spec §8.1)
- `src/lib/zoom.ts` (pure): `clampTranslate(scale, view, image)`, `fitContain(view, image)`, `doubleTapTarget(scale)`. Unit tests first.
- `src/components/PhotoLightbox.tsx`: a `Modal`, a gesture-handler pinch/pan/double-tap/swipe-down, and a reanimated shared value.
- Wire it to the photo on `Result.tsx`, and the "your catch" card and Home recent finds if they show the same photo. Strings in 4 languages.
- Check: tests, typecheck, simulator (open, pinch, pan, double-tap, swipe down).

### Task 2: Unload / delete buttons (spec §8.3)
- `src/lib/modelActions.ts` (pure): `chatModelActions(status)` and `visionModelActions(state)` return the actions available. Unit tests first.
- Brains chat-model row: always shows state and size; Unload/Load and Delete (with a confirm) whenever the model is downloaded.
- Vision: a release hook in `src/ai/executorchVision.ts`, plus a "delete model file" in `RegionDetail.tsx` that keeps the pack data. Scan offers "Download model" when the file is missing.
- Check: tests, typecheck, simulator.

### Task 3: Qwen chat model (spec §8.2)
- Pick the Qwen3 1.7B Instruct Q4_K_M GGUF: a pinned Hugging Face revision, with bytes and sha256 checked by downloading once on the Mac.
- Update `CHAT_MODEL`, `RETIRED_FILES` (+ the Gemma file), `memoryFit` thresholds, and the chat options (thinking off, strip `<think>`).
- Credits/licence screen; a new ADR superseding 005; `docs/ml-roadmap.md` §2.2.
- Unit tests: `memoryFit`, think-block stripping, retired-file cleanup.
- Host check: run the GGUF with llama.cpp on the Mac in 4 languages. The phone check (speed, RAM) is the user's; Qwen 2.5 1.5B is the fallback.

### Task 4: Update check (spec §8.4)
- `src/lib/updates.ts` (pure): `pendingUpdates(manifest, installed)`. Unit tests first.
- A `chat` entry in `packs/manifest.json`; `tools/packs/pin_checksums.py` handles it.
- The app reads the chat model from the manifest, with the compiled fallback.
- A shared download → verify → swap → delete-old path, with a test that a failed verify keeps the old file.
- Brains: a **Check for updates** button, plus a quiet check on open.

### Task 5: Name it yourself (spec §1, §2)
- `src/lib/speciesSearch.ts` (pure): `fold`, `searchSpecies`. Unit tests first, covering ł, ó, ä, ñ, Latin, fallback and order.
- `CatchEvent.source`. `catchBug` stores it; publish and backfill (`src/backend/sync.ts`, `usePublishCatch`) skip manual catches; `useXp` counts only species with a model catch; backup carries `source`. Tests for each.
- Scan passes `top3` and `aim` route params. `NameItSheet.tsx` (search + confirm). Override links on Result, Disambiguate and NoMatch. A "named by you" tag. Strings in 4 languages.
- Check: tests, typecheck, simulator flow.

### Task 6: Training contributions (spec §3)
- **Worker:**
  - the `contributions` table (`schema.sql` + `worker/migrations/0001_training_contributions.sql`) and the R2 binding
  - routes `POST /v1/training`, `GET` and `DELETE /v1/training/mine`, export plus signed object URL, and the account-delete cascade
  - smoke tests
- **App:**
  - `trainingShareOn`, the queue slice, and the photo re-encode, which strips EXIF
  - adapter methods (mock + cloudflare) and `useTrainingUploader` with backoff
  - the per-photo tick on the confirm card and on Add to Dex
  - the Brains switch, explainer, count and delete
  - unit tests: queue, payload with no location, aim fractions
- **Tooling:** `tools/training/pull_contributions.py`, with a self-check on a fake export.

### Task 7: Docs and copy (spec §4)
- The FAQ entries (faq9, faq10, faq2 pointer) and the privacy section in `tools/website/legal_content.py`; regenerate the site.
- README feature bullet.
- `docs/modules/training-contributions.md` (new), `docs/modules/backend-adapter.md`, the `docs/README.md` index row. Edit that file carefully, as it has another session's uncommitted line.
- `tasks/todo.md` section. That file also has another session's edits, so add only my section and commit only my hunk via an index blob.
- Show the user the pl/de/es copy.

### Final
- A whole-branch review: delegate if available, otherwise a fresh Opus agent.
- One fix pass.
- Then finishing-a-development-branch: no push without the user.

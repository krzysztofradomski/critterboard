# On-Device ML Roadmap

This is the master plan for swapping the mock AI seams in `src/ai/` with real on-device models.

It has **three tracks**, executed in order:

1. **MVP** — 20-species classifier + mocked LLM, end-to-end on a real iPhone.
2. **Full training** — the 200/1000-species Kaggle pipeline + real Gemma 3 1B-IT on device.
3. **Out-of-scope placeholders** — social, online sync, real map tiles, localization. Stubbed for now, deferred until the ML core ships.

Every step here maps to either a file in `training/` (Python) or a file in `src/ai/` (TypeScript). Nothing speculative — only work that produces a runnable artifact.

---

## Temporary cloud POC (pre-track)

Before Track 2's on-device Llama integration, chat now has a cloud proof-of-concept adapter:

- `src/ai/chatAdapter.ts` wires AI SDK (`ai` + `@ai-sdk/google`) to `gemini-2.5-flash`.
- Enabled only when `GEMINI_API_KEY` is present; otherwise it falls back to the in-app mock adapter.
- Prompt includes live user context + insect dataset so the model answers in Critterboard terms.

This is explicitly transitional. The target architecture is still fully on-device LLM inference.

---

## Track 1 — MVP (week 1)

> **Goal:** A user can point the camera at a ladybird, hit shutter, and `Result` shows "Seven-spot Ladybird · 94%". No cloud. Same prototype visuals.

### 1.1  Train the 20-species classifier ⟶ `training/local/`

| Step | Script | Output | Time |
|------|--------|--------|------|
| Download mini dataset | [`01_setup_and_download.py`](../training/local/01_setup_and_download.py) | `data/images/<taxon_id>/*.jpg` | ~20 min |
| Fine-tune EfficientNetV2-S | [`02_train.py`](../training/local/02_train.py) | `checkpoints/best_model.pth` | ~35 min on M2 |
| Sanity-check inference | [`03_inference_test.py --demo`](../training/local/03_inference_test.py) | console top-3 | seconds |
| Export for mobile | [`04_export.py`](../training/local/04_export.py) | `exported/insect_classifier.{onnx,mlpackage}` | ~30 s |

The training scripts already include the 20 Central-European species hard-coded in `TARGET_SPECIES`. Five of them (`mona`, `lhoc`, `hcat`, `mant`, `lady`) overlap with the `BUGS` array in [`src/data/bugs.ts`](../src/data/bugs.ts), so existing screens light up with no UI changes.

### 1.2  Wire the classifier seam ⟶ `src/ai/vision.ts` *(scaffolded)*

The seam takes a frame and returns ranked candidates:

```ts
type Candidate = { bugId: string; confidence: number };
classify(frame: Frame): Promise<Candidate[]>;     // top-3, descending
```

Two implementations live behind that seam:

- **`mockClassifier`** *(default today)* — reads `route.params.hint` for back-compat with the prototype. Lets the rest of the app evolve without blocking on the ML pipeline.
- **`coreMLClassifier`** / **`onnxClassifier`** *(production)* — calls into a thin native module that wraps `Vision` (iOS) or `react-native-fast-tflite`/ONNX Runtime (Android).

Selecting the real impl is a single import swap in `src/ai/index.ts`.

### 1.3  Drop the model into the bundle

- Copy `training/local/exported/insect_classifier.mlpackage` → `assets/models/insect_classifier.mlpackage`
- Copy `training/local/exported/insect_classifier.onnx` → `assets/models/insect_classifier.onnx`
- Copy `training/local/checkpoints/class_map.json` → `assets/models/class_map.json`

The `class_map.json` keys are taxon IDs; map them to `BUGS[].id` in `src/data/classMap.ts` (a 20-row hash). Anything outside the map falls back to the closest match in `BUGS`.

### 1.4  Rewire `Scan` ⟶ `src/screens/Scan.tsx`

- Shutter currently calls `nav.go('result', { id: hint })`.
- After this change: shutter awaits `vision.classify(frame)` → routes to `Result` for the top candidate, or to `Disambiguate` if the spread between #1 and #2 is < 15 pp.

### 1.5  Bench the round-trip

Target on iPhone 13 (A15, 4 GB RAM):

| Stage | Budget |
|-------|--------|
| Capture frame | < 16 ms (60 fps) |
| Preprocess (resize+normalize) | < 8 ms |
| CoreML inference | < 80 ms |
| JS round-trip | < 30 ms |
| **Total shutter → Result** | **< 200 ms** |

Anything slower than 250 ms feels laggy and is treated as a bug.

### 1.6  Exit criteria for MVP

- [ ] 5 different real insects identified correctly with confidence > 70% under good light
- [ ] No JS thread freezes on shutter
- [ ] App memory stays under 600 MB during scan
- [ ] `npm run typecheck` clean

---

## Track 2 — Full training (weeks 2–4)

> **Goal:** Same UX, 200 species instead of 20, plus a real Gemma 3 1B-IT running locally for the persona chat.

### 2.1  Scale the classifier ⟶ `training/kaggle/insect_classifier_training.ipynb`

The Kaggle notebook is the same EfficientNetV2-S recipe with three knobs in `CFG`:

```python
CFG = {
    'iconic_taxon':         'Insecta',   # 'Lepidoptera' for a faster first run
    'min_obs_per_species':  200,         # lower = more species, less per-class quality
    'images_per_species':   250,
    'max_species':          200,         # 200 → ~50k images, ~8h. 1000 → ~250k images, ~18h.
    ...
}
```

Two-phase fine-tune, AMP enabled, 30 epochs. Stretch run goes to 1000 species and ~70% top-1 on a held-out test split.

#### 2.1.1  Iterate the dataset

Three knobs to push accuracy up without retraining from scratch:

- **Curate the species list.** Start with `Lepidoptera` (butterflies/moths) — fewer visually-similar species → higher per-class accuracy. Add `Coleoptera`, then `Hymenoptera` once the head is stable.
- **Filter low-quality observations.** The notebook already orders by `votes`; tighten to `quality_grade=research` + `identifications_most_agree=true` if dataset noise shows up in the confusion matrix.
- **Class-balanced sampling.** `WeightedRandomSampler` is in place — verify the histogram of class counts before each run.

#### 2.1.2  Eval beyond top-1

- Per-class precision/recall to find the species the model collapses together — these are usually mimics (hoverfly vs wasp, monarch vs viceroy). Surface them as "lookalikes" in the species DB so `Disambiguate` can explain *why* it's unsure.
- Confusion matrix exported as a PNG + JSON in `checkpoints/`.

### 2.2  Real local LLM ⟶ `src/ai/llm.ts` *(scaffolded)* + `training/personas/` *(scaffolded)*

The persona-training pipeline mirrors `training/local/` exactly — five numbered Python scripts plus a Kaggle notebook. See [`training/personas/README.md`](../training/personas/README.md) for the full quickstart. The seam in `src/ai/llm.ts` is designed so that "different system prompt" and "different LoRA adapter on the same base" look identical from the screen's point of view.


The seam is already typed:

```ts
type LlmRuntime = {
  load(modelPath: string): Promise<void>;
  complete(prompt: string, opts?: CompleteOpts): AsyncIterable<string>;
  unload(): Promise<void>;
};
```

Drop-in implementations:

- **`mockRuntime`** *(today)* — picks a canned line keyword-biased by the user's input. Already in `src/ai/chat.ts`, just moved behind the seam.
- **`llamaRn`** *(production)* — wraps [`llama.rn`](https://github.com/mybigday/llama.rn). Singleton load, streamed `complete()`, persona system prompt built from `PERSONAS[persona].systemPrompt`.

Model: `gemma-3-1b-it-q4_k_m.gguf` (≈ 670 MB RAM, ≈ 12–18 tok/s on iPhone 13 with Metal).
Source: `https://huggingface.co/google/gemma-3-1b-it-GGUF`

Gemma 3 1B-IT was chosen over Llama 3.2 1B for three reasons:
- ~20% smaller RAM footprint at the same Q4_K_M quantisation level
- Better multilingual output quality (important: the app ships in EN/DE/ES/PL)
- Newer architecture (Feb 2025) with stronger instruction-following per parameter

Chat template (used by `buildPrompt` in `src/ai/llm.ts`):
```
<start_of_turn>system
{system}<end_of_turn>
<start_of_turn>user
{user}<end_of_turn>
<start_of_turn>model
```

LoRA adapters (≈ 15 MB each) are trained on top of the Gemma 3 1B base via the pipeline in `training/personas/`. The base model stays loaded; adapters hot-swap on persona change.

Tone guarantees come from the per-persona `systemPrompt` strings already in [`src/personas/index.ts`](../src/personas/index.ts) — no new copy required.

### 2.2.1  Memory guard

```ts
// src/ai/llm.ts
if (totalMemoryMB() < 2_000) {
  // Fall back to mockRuntime, show a "lite mode" badge in Settings.
  // Gemma 3 1B-IT Q4_K_M needs ~670 MB for the base + ~15 MB per adapter;
  // 2 GB leaves headroom for the OS, the vision model, and the rest of the app.
}
```

Hard-disable Llama on devices with < 4 GB RAM. The mock fallback is good enough — the user just doesn't get streaming personality.

### 2.3  Persona-aware streaming chat

`Chat.tsx` already has a typing indicator. Two changes:

- `complete()` returns an `AsyncIterable<string>` of token chunks → append to the last bubble live instead of waiting for the full reply.
- On persona switch, cancel any in-flight generation and reset the system prompt.

### 2.4  Sound ID model (deferred — entry point hidden)

The `SoundID` screen exists in the router but the navigation button has been removed from `Scan.tsx`. The screen remains reachable via deep-link for future work; it is **not** a regression to add it back later.

Sound ID is a separate ML problem from visual ID and cannot share the regional pack `labelMap`:

- **Different taxonomy**: acoustic species (crickets, cicadas, katydids) are largely disjoint from the 20 Central European visual species. A shared `labelMap` would need separate class indices and a separate training dataset.
- **Different preprocessing**: audio inference requires real-time PCM capture → STFT → log-mel spectrogram before any classifier runs. `expo-av` is not in the dependency tree; adding it requires native config on both platforms.
- **Different training data**: suitable datasets (Freesound, GBIF sound observations, Xeno-canto) are entirely separate from the iNaturalist photo corpus used for the visual pipeline.
- **Different model size/latency profile**: a log-mel spectrogram classifier needs ~2–4 s of audio per inference pass, making it fundamentally different from the sub-200 ms shutter→result budget of visual ID.

For implementation requirements, see `tasks/todo.md` — Sound ID is tracked there with full sub-tasks.

### 2.5  Exit criteria for full training

- [ ] 200-species model ships in `assets/models/`, top-3 > 85% on held-out test
- [ ] Gemma 3 1B-IT Q4_K_M loads in < 4 s on iPhone 13
- [ ] First streamed token visible in < 600 ms
- [ ] Lite-mode fallback verified on a 3 GB Android device

---

## Track 3 — Out-of-scope placeholders

These are intentionally **not** part of MVP or full-training scope. They exist as basic placeholders in the app today and stay that way until Tracks 1+2 ship.

| Surface | Today | Deferred until |
|---------|-------|----------------|
| Leaderboard | `LEADERS` array in [`src/data/leaderboard.ts`](../src/data/leaderboard.ts), gated behind `profile.networkOn` | post-MVP |
| Friends / followers | `FRIENDS` array, in-memory `followed` Set | post-MVP |
| Map of sightings | Hand-drawn SVG in [`src/screens/Map.tsx`](../src/screens/Map.tsx) | post-MVP |
| Localization | English-only, language picker is presentational | post-MVP |
| Activity feed | Static array in [`src/screens/Activity.tsx`](../src/screens/Activity.tsx) | post-MVP |
| Streak / freezes | Hard-coded pattern in [`src/screens/Streak.tsx`](../src/screens/Streak.tsx) | post-MVP |

Each surface keeps its placeholder data and stickered visuals so the app remains demoable end-to-end. When the time comes to make them real, every one is a "swap the import" operation against the existing screens — same seam pattern as the AI.

---

## File map

```
training/
  README.md                                   # entry point + new-pack guide
  local/
    insect_data.py                            # 20-species DB with descriptions + sources
    train_lite.py                             # MobileNetV3-Small, any CPU (~40 min)
    generate_demo_data.py                     # synthetic images for offline/CI use
    01_setup_and_download.py                  # iNaturalist S3 → ./data/images/ (~20 min)
    02_train.py                               # EfficientNetV2-S, M2 MPS (~35 min)
    03_inference_test.py                      # CLI sanity check
    04_export.py                              # .pte + ONNX + CoreML + classMap.ts
    requirements.txt
  kaggle/
    insect_classifier_training.ipynb          # vision: full EU run, T4 x2
  personas/                                   # Gemma-3-1B-IT LoRA per persona
    README.md
    examples/{larva,snail,maywind}.jsonl
    01_seed_examples.py … 05_export_adapters.py
    requirements.txt

assets/
  models/
    README.md                                 # drop-zone instructions
    class_map.json                            # committed — index → scientific name
    insect_classifier.pte   (gitignored)      # ExecuTorch — primary mobile path
    insect_classifier.onnx  (gitignored)      # ONNX Runtime fallback
    insect_classifier.mlpackage (gitignored)  # CoreML fallback (iOS)

src/ai/
  index.ts                                    # USE_NATIVE_VISION flag + all AI exports
  vision.ts                                   # VisionClassifier interface + mock impl
  executorchVision.ts                         # useExecutorchClassifier() hook
  classMap.ts                                 # scientific name + index → bug ID (auto-generated)
  geminiVision.ts                             # cloud fallback (POC)
  llm.ts                                      # AsyncIterable<token>, swap-in seam
  chat.ts                                     # delegates to llm.ts

src/data/
  bugs.ts                                     # 20 Central EU species, BugTrait, CAUGHT_IDS

docs/
  ml-roadmap.md                               # this file
```

## Status — at a glance

| Track | Status |
|-------|--------|
| 1 · TypeScript seams in `src/ai/` | ✅ done |
| 1 · `training/local/` scripts (full + lite pipelines) | ✅ done |
| 1 · 20-species `insect_data.py` with sources | ✅ done |
| 1 · MobileNetV3-Small checkpoint trained (synthetic data) | ✅ done — `checkpoints/best_model_lite.pth` |
| 1 · `src/data/bugs.ts` — 20 Central EU species | ✅ done |
| 1 · `src/ai/classMap.ts` — scientific name + index → bug ID | ✅ done |
| 1 · `src/ai/executorchVision.ts` — `useExecutorchClassifier()` hook | ✅ done |
| 1 · `react-native-executorch` wired into `Scan.tsx` | ✅ done — activate by setting `MODEL_SOURCE` + `USE_NATIVE_VISION = true` |
| 1 · Generate real `.pte` from iNaturalist-trained weights | ⏳ pending — run `04_export.py --pte` after `pip install executorch` |
| 1 · Bench shutter → Result round-trip on device | ⏳ pending |
| 2 · Kaggle full-EU run (200 species) | ⏳ pending |
| 2 · `llama.rn` integration | ⏳ pending |
| 2 · `training/personas/` scaffold | ✅ done — run when system-prompt drift > 10% |
| 2 · Sound ID nav entry point | ✅ removed — screen kept in router, full plan in `tasks/todo.md` |
| 3 · Placeholder surfaces | 🅿️ deliberately paused |

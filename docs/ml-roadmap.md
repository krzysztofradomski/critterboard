# On-Device ML Roadmap

This is the master plan for swapping the mock AI seams in `src/ai/` with real on-device models.

It has **three tracks**, executed in order:

1. **MVP** — 20-species classifier + mocked LLM, end-to-end on a real iPhone.
2. **Full training** — the 200/1000-species Kaggle pipeline + real Llama 3.2 1B on device.
3. **Out-of-scope placeholders** — social, online sync, real map tiles, localization. Stubbed for now, deferred until the ML core ships.

Every step here maps to either a file in `training/` (Python) or a file in `src/ai/` (TypeScript). Nothing speculative — only work that produces a runnable artifact.

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

> **Goal:** Same UX, 200 species instead of 20, plus a real Llama 3.2 1B running locally for the persona chat.

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

Model: `Llama-3.2-1B-Instruct-Q4_K_M.gguf` (≈ 800 MB RAM, ≈ 10–15 tok/s on iPhone 13 with Metal).

Tone guarantees come from the per-persona `systemPrompt` strings already in [`src/personas/index.ts`](../src/personas/index.ts) — no new copy required.

### 2.2.1  Memory guard

```ts
// src/ai/llm.ts
if (totalMemoryMB() < 4_000) {
  // Fall back to mockRuntime, show a "lite mode" badge in Settings.
}
```

Hard-disable Llama on devices with < 4 GB RAM. The mock fallback is good enough — the user just doesn't get streaming personality.

### 2.3  Persona-aware streaming chat

`Chat.tsx` already has a typing indicator. Two changes:

- `complete()` returns an `AsyncIterable<string>` of token chunks → append to the last bubble live instead of waiting for the full reply.
- On persona switch, cancel any in-flight generation and reset the system prompt.

### 2.4  Sound ID model (optional Track 2 stretch)

The `SoundID` screen is already wired to the same router. Reuse `efficientnet_lite` on log-mel spectrograms; same export pipeline, smaller model (~3 MB). Defer until visual ID is stable.

### 2.5  Exit criteria for full training

- [ ] 200-species model ships in `assets/models/`, top-3 > 85% on held-out test
- [ ] Llama 3.2 1B Q4 loads in < 4 s on iPhone 13
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
  README.md                                   # entry point — both vision and personas
  local/                                      # vision: M2 mini run
    01_setup_and_download.py                  # ~20 min,  iNaturalist S3 → ./data/images/
    02_train.py                               # ~35 min,  EfficientNetV2-S, M2 MPS
    03_inference_test.py                      # CLI sanity check
    04_export.py                              # ONNX + CoreML
    requirements.txt
  kaggle/
    insect_classifier_training.ipynb          # vision: full EU run, T4 x2
  personas/                                   # Llama-3.2-1B LoRA per persona
    README.md
    examples/{larva,snail,maywind}.jsonl      # 10 hand-written seeds each
    01_seed_examples.py                       # bootstrap ~80/persona via Claude
    02_curate.py                              # CLI accept/edit/reject
    03_train_lora.py                          # PEFT LoRA, one adapter per persona
    04_inference_test.py                      # baseline (sysprompt) vs LoRA, side-by-side
    05_export_adapters.py                     # LoRA → GGUF for llama.rn
    requirements.txt
    kaggle/
      persona_lora_training.ipynb             # T4 x2 variant of step 03

assets/
  models/
    README.md                                 # what to drop here and from where

src/ai/
  index.ts                                    # picks mock vs production impls
  vision.ts                                   # Candidate[], swap-in seam
  llm.ts                                      # AsyncIterable<token>, swap-in seam
  chat.ts                                     # delegates to llm.ts

docs/
  ml-roadmap.md                               # this file
```

## Status — at a glance

| Track | Status |
|-------|--------|
| 1 · MVP scaffold (TypeScript seams in `src/ai/`) | ✅ done |
| 1 · `training/local/` scripts present | ✅ done |
| 1 · Run `01..04` once, drop into `assets/models/`, ship | ⏳ pending — one afternoon of work |
| 2 · Kaggle full-EU run | ⏳ pending |
| 2 · `llama.rn` integration | ⏳ pending |
| 2 · `training/personas/` scaffold | ✅ done — run when system-prompt drift > 10% |
| 3 · Placeholder surfaces | 🅿️ deliberately paused |

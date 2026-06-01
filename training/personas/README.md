# Critterboard — Persona LoRA Training

Pipeline for fine-tuning per-persona LoRA adapters on top of a shared `google/gemma-3-1b-it` base. **Do not run this until the system-prompt approach has shipped and you've measured real drift in user chats** — see `docs/ml-roadmap.md` § Track 2 for the decision criteria.

## What this produces

| File | Size | Used by |
|------|------|---------|
| `exported/larva.gguf` | ~15 MB | `llamaRnRuntime` (persona = larva) |
| `exported/snail.gguf` | ~15 MB | `llamaRnRuntime` (persona = snail) |
| `exported/maywind.gguf` | ~15 MB | `llamaRnRuntime` (persona = maywind) |

Adapters are **swapped at persona-change time** — the base model stays loaded once. ~670 MB base + 3 × 15 MB adapters = ~715 MB total bundle weight.

## Pipeline (5 steps)

| Step | Script | What it does | Where |
|------|--------|--------------|-------|
| 0 | hand-curated seeds | 10 dialogue pairs per persona, written by you | `examples/{larva,snail,maywind}.jsonl` |
| 1 | [`01_seed_examples.py`](01_seed_examples.py) | Bootstraps ~80 more examples per persona via Anthropic API using the same system prompts shipped in the app | local |
| 2 | [`02_curate.py`](02_curate.py) | CLI walk-through to accept / edit / reject each generated example | local |
| 3 | [`03_train_lora.py`](03_train_lora.py) | PEFT LoRA train, one adapter per persona | Kaggle T4 (or local CUDA) |
| 4 | [`04_inference_test.py`](04_inference_test.py) | Side-by-side: base + system prompt vs base + LoRA | local |
| 5 | [`05_export_adapters.py`](05_export_adapters.py) | LoRA safetensors → llama.cpp GGUF adapter format | local |

## Quickstart

```bash
cd training/personas
pip install -r requirements.txt

# Step 1: bootstrap (~5 min, ~$2 of Claude API spend)
export ANTHROPIC_API_KEY=...
python 01_seed_examples.py

# Step 2: curate (~1-2 hours of operator time, the actual bottleneck)
python 02_curate.py larva
python 02_curate.py snail
python 02_curate.py maywind

# Step 3: train (best on Kaggle — see kaggle/persona_lora_training.ipynb)
# locally on M-series Mac:
PYTORCH_ENABLE_MPS_FALLBACK=1 python 03_train_lora.py

# Step 4: eyeball the output
python 04_inference_test.py --persona snail --prompt "what's the difference between a bee and a hoverfly?"

# Step 5: ship-ready adapters
python 05_export_adapters.py
cp exported/*.gguf ../../assets/models/
```

## Data shape

Every line in `data/curated/<persona>.jsonl` is one training example:

```json
{
  "instruction": "what's the difference between a moth and a butterfly?",
  "input": "",
  "output": "Antennae give it away — butterflies have thin clubbed tips, moths have feathery or threadlike ones. Take a closer look at the resting wings too."
}
```

The persona's `systemPrompt` from `src/personas/index.ts` is **prepended at training time**, not stored per-row. That way swapping the wording of a system prompt later doesn't invalidate the dataset.

## Target: ~300 curated examples per persona

| Count per persona | Outcome |
|-------------------|---------|
| 30 | Tone wobbles, but recognisable |
| 100 | Stable for 5–10 turn chats |
| 300 | Stable across a whole session — this is the goal |
| 1000+ | Diminishing returns; risk of overfitting the base's helpfulness |

The bottleneck is **curation hours**, not GPU minutes. Plan one full day of human review.

## Why LoRA and not full fine-tune

- **Bundle size**: a full 1B fine-tune is ~700 MB. Three personas = 2.1 GB → app gets rejected from the App Store.
- **LoRA**: ~15 MB per adapter, hot-swappable at runtime via `llama.cpp`'s adapter API.
- **Base upgrades for free**: when a newer Gemma ships, swap `CFG["base_model"]` in `03_train_lora.py`, retrain — same data, same script.

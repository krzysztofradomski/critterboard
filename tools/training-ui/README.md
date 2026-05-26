# Critterboard Training Dashboard

A local Streamlit GUI for training both the insect vision classifier and the persona LoRA adapters. Run it on your own machine — no cloud account needed.

## Setup

All commands assume you are at the **repo root**. On macOS (Homebrew Python) and
most modern Linux distros, the system Python is "externally managed" (PEP 668),
so install everything into a project-local virtual environment:

```bash
# One-time: create the venv (Python 3.10+ recommended)
python3 -m venv .venv

# Activate it (do this in every new shell)
source .venv/bin/activate

# Install dashboard dependencies (streamlit + pandas + Pillow)
python -m pip install --upgrade pip
python -m pip install -r tools/training-ui/requirements.txt

# Install ML dependencies for the pipeline(s) you want to run
python -m pip install -r training/local/requirements.txt        # vision classifier
python -m pip install -r training/personas/requirements.txt     # persona LoRA
```

> Don't want to activate? You can always call binaries directly via
> `./.venv/bin/python` and `./.venv/bin/streamlit`.

## Launch

```bash
# With the venv activated:
streamlit run tools/training-ui/app.py

# Or without activating:
./.venv/bin/streamlit run tools/training-ui/app.py
```

Opens at `http://localhost:8501` in your browser.

## What's inside

| Tab | What it does |
|-----|-------------|
| **🦋 Vision Classifier** | Download dataset → configure & run training → test inference on an uploaded photo → export ONNX + CoreML |
| **🧠 Persona Training** | Generate seed examples via Claude API → curate them one-by-one → train LoRA adapters → compare base vs LoRA → export GGUF |
| **📦 Model Status** | Overview of all expected model files, training artifacts, training-curve chart, and environment/package check |

## Vision classifier pipeline (4 steps)

1. **Download** — fetches ~150 images × 20 Central EU species from iNaturalist (~2 GB, 15–30 min)
2. **Train** — EfficientNetV2-S fine-tune with configurable hyperparams; live epoch log in the browser
3. **Test** — upload any photo and see top-K predictions with confidence bars
4. **Export** — one click to produce `insect_classifier.onnx` + `insect_classifier.mlpackage`, then copy to `assets/models/`

## Persona training pipeline (5 steps)

1. **Seed** — bootstrap ~80 dialogue examples per persona via Anthropic API (~$1–3 with Haiku)
2. **Curate** — review examples one-by-one (Accept / Edit / Reject); progress bar tracks the 300-example target
3. **Train** — LoRA fine-tune on `Llama-3.2-1B-Instruct`; configurable rank, alpha, epochs
4. **Test** — side-by-side comparison: base model + system prompt vs base + LoRA
5. **Export** — GGUF adapter files ready for `llama.rn`, then copy to `assets/models/`

## Cleanup / Uninstall

Use `tools/training-ui/cleanup.sh` to remove anything the dashboard installed
or generated. It always shows a size preview and asks for confirmation
(use `-y` to skip, `--dry-run` to just preview).

```bash
# Preview a full project wipe (no deletion):
bash tools/training-ui/cleanup.sh --all --dry-run

# Remove just the virtualenv (all pip packages: streamlit, torch, transformers, …):
bash tools/training-ui/cleanup.sh --venv

# Remove downloaded datasets + seed/curated examples:
bash tools/training-ui/cleanup.sh --data

# Remove training checkpoints + exported .onnx / .mlpackage / .gguf:
bash tools/training-ui/cleanup.sh --artifacts

# Full project wipe (venv + data + artifacts; keeps global caches):
bash tools/training-ui/cleanup.sh --all

# Nuke everything, including the global HuggingFace + PyTorch caches:
bash tools/training-ui/cleanup.sh --nuke
```

Notes:

- Files copied to `assets/models/` are **not** touched — those are deliverables,
  not training infrastructure. Delete them manually if you want a full reset.
- `--hf-cache` and `--torch-cache` are opt-in because those directories
  (`~/.cache/huggingface`, `~/.cache/torch`) are global and may be shared with
  other projects on your machine.
- If you installed the requirements globally (no venv), uninstall packages with:
  ```bash
  python -m pip uninstall -y -r tools/training-ui/requirements.txt \
                              -r training/local/requirements.txt \
                              -r training/personas/requirements.txt
  ```

## Notes

- The dashboard runs the existing training scripts as subprocesses — it does not contain its own ML code.
- Training hyperparams in the Vision tab are passed to `02_train.py` via `CB_*` environment variables; all have the same defaults as the script, so running the script directly is unchanged.
- Long-running jobs (training) stream live output into the browser. The UI will appear unresponsive during training — this is expected; check the scrolling log.
- The Persona tab requires an `ANTHROPIC_API_KEY` only for Step 1 (seed generation). All other steps run fully offline.

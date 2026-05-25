# Critterboard Training Dashboard

A local Streamlit GUI for training both the insect vision classifier and the persona LoRA adapters. Run it on your own machine — no cloud account needed.

## Setup

```bash
# Install dashboard dependencies (streamlit + pandas + Pillow)
pip install -r tools/training-ui/requirements.txt

# Install ML dependencies for the pipeline(s) you want to run
pip install -r training/local/requirements.txt        # vision classifier
pip install -r training/personas/requirements.txt     # persona LoRA
```

## Launch

```bash
# From the repo root:
streamlit run tools/training-ui/app.py

# Or from this directory:
cd tools/training-ui
streamlit run app.py
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

## Notes

- The dashboard runs the existing training scripts as subprocesses — it does not contain its own ML code.
- Training hyperparams in the Vision tab are passed to `02_train.py` via `CB_*` environment variables; all have the same defaults as the script, so running the script directly is unchanged.
- Long-running jobs (training) stream live output into the browser. The UI will appear unresponsive during training — this is expected; check the scrolling log.
- The Persona tab requires an `ANTHROPIC_API_KEY` only for Step 1 (seed generation). All other steps run fully offline.

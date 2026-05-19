# `assets/models/`

Drop the exported insect classifier and (eventually) the Llama GGUF here.

## Expected files

| File | Source | Used by |
|------|--------|---------|
| `insect_classifier.mlpackage` | `training/local/04_export.py` (or Kaggle → local export) | iOS native module |
| `insect_classifier.onnx` | same | Android native module |
| `class_map.json` | `training/local/checkpoints/class_map.json` | `src/ai/classMap.ts` |
| `llama-3.2-1b-instruct-q4_k_m.gguf` | [Meta on Hugging Face](https://huggingface.co/meta-llama/Llama-3.2-1B-Instruct) → quantized to Q4_K_M | `llama.rn` runtime |

## Bundle wiring

### iOS (Xcode)
1. Drag `insect_classifier.mlpackage` into the Xcode project.
2. Tick **Copy items if needed** and **Add to target: Critterboard**.
3. The `.mlpackage` becomes loadable via `MLModel(contentsOf:)` in the native module.

### Android (`react-native-fast-tflite` or ONNX Runtime)
1. Copy `insect_classifier.onnx` into `android/app/src/main/assets/`.
2. The native module reads it via `context.assets.open("insect_classifier.onnx")`.

### Llama GGUF (both platforms)
The GGUF is large (~800 MB at Q4_K_M); ship it as a download-on-first-launch
rather than bundling. The `Settings` screen already has a "Larva-3B" tile
with a progress bar that's wired to a mock; point it at the real download
service when the time comes.

## Why this directory is empty in git

Models are large binaries — keep them out of the repo, generate them via
`training/`. See `.gitignore`.

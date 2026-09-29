# `assets/models/`

Drop the exported insect classifier and (eventually) the Llama GGUF here.

## Expected files

| File | Source | Used by |
|------|--------|---------|
| `insect_classifier.mlpackage` | `training/local/04_export.py` (or Kaggle → local export) | iOS native module |
| `insect_classifier.onnx` | same | Android native module |
| `class_map.json` | `training/local/checkpoints/class_map.json` | `src/ai/classMap.ts` |
| *(not bundled)* `gemma-4-E2B-it-Q4_K_M.gguf` | Downloaded at runtime from [unsloth/gemma-4-E2B-it-GGUF](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF); see `src/ai/chatModel.ts` | `llama.rn` runtime |

## Bundle wiring

### iOS (Xcode)
1. Drag `insect_classifier.mlpackage` into the Xcode project.
2. Tick **Copy items if needed** and **Add to target: Critterboard**.
3. The `.mlpackage` becomes loadable via `MLModel(contentsOf:)` in the native module.

### Android (`react-native-fast-tflite` or ONNX Runtime)
1. Copy `insect_classifier.onnx` into `android/app/src/main/assets/`.
2. The native module reads it via `context.assets.open("insect_classifier.onnx")`.

### Chat model GGUF (both platforms)
The chat model (Gemma 4 E2B, 3.1 GB) is never bundled: Settings → On-device
chat downloads it into the app's documents folder (`src/ai/chatModel.ts`).
See `docs/decisions/005-gemma-4-only-chat.md`.

## Why this directory is empty in git

Models are large binaries — keep them out of the repo, generate them via
`training/`. See `.gitignore`.

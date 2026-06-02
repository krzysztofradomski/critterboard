<p align="center">
  <img src="assets/icons/icon-stickerbug_1024x1024.png" width="120" alt="Critterboard app icon" />
</p>

<h1 align="center">Critterboard</h1>

<p align="center"><strong>id any bug · stay offline · be smug</strong></p>

<p align="center">
  The free insect hunting game that runs entirely on your phone.<br />
  No cloud. No account. No $$$.
</p>

<p align="center">
  <code>Coming soon · iOS &amp; Android</code> · MIT Open Source
</p>

## What it does

|                  |                                         |
| ---------------- | --------------------------------------- |
| **Snap & ID**    | Local model. Zero uploads. Ever.        |
| **Hunt & Rank**  | Quests, XP, rarity tiers, global board. |
| **On-Device AI** | 3 guide personas. Snarky to calm.       |

✓ no account · ✓ no internet needed · ✓ no $$$ · ✓ no tracking by default · ✓ MIT licensed

### Optional social (opt-in)

Bug ID and AI always stay on-device. If you turn **Network** on in Settings, the app may sync **anonymous, pseudonymous** activity — catches, XP, friend links, leaderboard rank — to a [Cloudflare Workers](https://workers.cloudflare.com/) backend so social features work. No account, no email, no ads. Flip Network off and nothing leaves the phone.

## Current work

Project status lives in [`tasks/todo.md`](tasks/todo.md) — the living checklist of what's shipped and what's next.

**Local AI training** — The app seams, training pipelines, and React Native integration are complete. One step remains before native vision is live on-device:

- **Vision** — MobileNetV3-Small trained on 20 Central European species. `react-native-executorch` is wired into `Scan.tsx` and dormant until the `.pte` is generated. To activate: `pip install executorch && python training/local/04_export.py --pte`, then set `MODEL_SOURCE` in `src/ai/executorchVision.ts` and flip `USE_NATIVE_VISION = true` in `src/ai/index.ts`. Full pipeline docs in [`training/README.md`](training/README.md).
- **Personas** — LoRA pipeline for on-device Gemma 3 1B-IT (`training/personas/`). Next step: bundle a GGUF and flip `USE_LLAMA_RN` in `src/ai/`.

See [`docs/ml-roadmap.md`](docs/ml-roadmap.md) for the three-track plan and exit criteria.

A local **Streamlit training dashboard** lives at [`tools/training-ui/`](tools/training-ui/) — run it to manage dataset downloads, kick off training jobs, test inference interactively, and copy exported models into `assets/models/`. See that folder's README for setup.

## Links

- Landing page : [`critterboard.app`](https://critterboard.app)
- Contact: [hello@critterboard.app](mailto:hello@critterboard.app)

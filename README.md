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

Project status lives in [`tasks/todo.md`](tasks/todo.md), the living checklist of what's shipped and what's next. To build and test on your own Mac and iPhone, follow [`docs/handoff.md`](docs/handoff.md).

**Where things stand**

- **Vision:** a 1,000-species European insect and spider model, `eu-1k-commercial-v1`, reaching 78.2% top-1 and 90.1% top-3 on held-out photos. It runs on-device through `react-native-executorch` and is licence-clean for commercial use: it was trained only on CC0/CC-BY photos and built on Google's Apache-2.0 base. It ships in the **Central Europe region pack**, which the app downloads from Settings. Without the pack, Scan asks you to install it. See [`training/vision/README.md`](training/vision/README.md) and the [model card](training/vision/results/commercial-1k-v1/MODEL_CARD.md).
- **Species icons:** every pack species has a sticker icon drawn from a real CC0 photo. The icons come with the pack as one ~9 MB file and fall back to emoji. See [`docs/modules/species-icons.md`](docs/modules/species-icons.md).
- **Chat:** fully on-device with Google's **Gemma 4 E2B** (Apache 2.0) through `llama.rn`, downloaded once from Settings (3.1 GB). Without it, chat is disabled; there are no scripted replies, and the web preview has no chat ([ADR 005](docs/decisions/005-gemma-4-only-chat.md)). Personas are system prompts; a LoRA pipeline for per-persona adapters is in [`training/personas/`](training/personas/), but it isn't shipped.
- **Map:** an offline MapLibre + PMTiles spike is behind a flag; see [`docs/modules/offline-map.md`](docs/modules/offline-map.md).
- **Not yet done:** the first run on a real iPhone, the Cloudflare backend deploy, and store submission. All three are covered in the handoff.

See [`docs/ml-roadmap.md`](docs/ml-roadmap.md) for the ML plan and [`docs/README.md`](docs/README.md) for the architecture docs.

The original 20-species pipeline (`training/local/`) and its Streamlit dashboard ([`tools/training-ui/`](tools/training-ui/)) are still in the repo for reference.

## Links

- Landing page : [`critterboard.app`](https://critterboard.app)
- Contact: [hello@critterboard.app](mailto:hello@critterboard.app)

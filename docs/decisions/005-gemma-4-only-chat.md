# ADR 005 — Chat runs only on Gemma 4 E2B

`#adr` `#ml` `#chat`

**Status:** accepted (Sep 2026). Replaces the chat part of [[004-remove-cloud-gemini]].

## Context

- After ADR 004, chat had three paths:
  - Gemma 3 1B via `llama.rn` on phones;
  - Chrome's built-in Gemini Nano on web;
  - scripted persona replies when neither was available.
- **Licence:** Gemma 3 is under Google's Gemma Terms of Use. That's a custom licence with a prohibited-use policy you must pass on to users, and Google can change it. Gemma 4 (April 2026) is **Apache 2.0**, matching the vision model's base weights.
- **Model size:** Gemma 4 has no 1B model. The smallest is **E2B**: 5.1B parameters in total, 2.3B active, a ~3.1 GB download at 4-bit, and about 3 GB of RAM while loaded.
- **Languages:** the app ships in EN/PL/DE/ES, so Polish support mattered. Gemma 4 covers 140+ languages. Smaller alternatives were reviewed and rejected:
  - Granite 4.0 H 1B, SmolLM3 3B and LFM2.5 1.2B don't support Polish;
  - LFM2.5 also has a revenue-capped licence;
  - community Qwen3 merges and BitCPM4 ternary models carry quality risk.
- **Runtime:** the pinned `llama.rn` 0.12.9 already supports the `gemma4` architecture and applies the GGUF's own chat template.

## Decision

- **One chat model everywhere:** Gemma 4 E2B instruct, Q4_K_M GGUF, from `unsloth/gemma-4-E2B-it-GGUF`. The file is downloaded in Settings and stored on the phone.
- **No fallback.** Without the model, the Chat screen shows a card ("Download Gemma 4 to chat" → Settings) instead of the input. The scripted replies and the mock runtime are removed.
- **Web has no chat.** Chrome's built-in model (`webNativeLlm.ts`) is removed, and the web preview explains that chat needs the phone app.
- **Memory tiers** (user decision), from the phone's total RAM (`expo-device`). Phones report slightly less than their marketed RAM, so the thresholds sit below the round numbers:
  - **6 GB class and up** (reports ≥ 5 GiB): download directly.
  - **4 GB class** (3.3–5 GiB, or unknown): Settings asks for confirmation before downloading, warning that replies may be slow and the app may close.
  - **Below that:** chat is disabled. Settings shows "not supported" and Chat says so.
- **Prompt:**
  - messages go through the model's embedded chat template (`jinja: true`) with thinking turned off;
  - the persona `systemPrompt` is sent as the system message, together with "reply in the app language" and the topic;
  - the last 8 turns are included, normalised to alternate user/assistant.
- **Settings:** the toggle downloads the model. Turning it off asks for confirmation, then unloads and deletes the file to free 3.1 GB. The old Gemma 3 file is deleted on sight.

## Consequences

- One Apache-2.0 chat model and no per-user licence obligations to pass on. The Settings credits list Gemma 4.
- A 3.1 GB download before anyone can chat, instead of 0.7 GB, or chatting straight away with scripted replies.
- Chat is unavailable on web and on phones with less than about 4 GB of RAM; 4 GB phones run it at their own risk after a warning.
- New native dependency: `expo-device` (for the RAM check), so native builds need a fresh `pod install`.
- Still to check on a phone (see [[../handoff]]):
  - whether the download works without a Hugging Face login;
  - load time, tokens per second and memory on a 6 GB and a 4 GB iPhone;
  - the persona tone in all four languages.
- If anonymous downloads fail, host the GGUF ourselves (GitHub Releases or R2).
- The per-persona LoRA pipeline in `training/personas/` targets Gemma 3 1B. It would need retargeting to Gemma 4 E2B if adapters are ever shipped.

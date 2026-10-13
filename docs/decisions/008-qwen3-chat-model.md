# ADR 008 — Chat runs on Qwen3 1.7B

`#adr` `#ml` `#chat`

**Status:** superseded by [[009-apple-intelligence-chat]] (13 Oct 2026: on the iPhone 13 mini it overheated, froze and wrote poor Polish; chat now runs on Apple Intelligence). Earlier: accepted (Oct 2026), superseding [[005-gemma-4-only-chat]] for the model choice. Its other decisions stay: chat is on-device only, with no scripted fallback and no web chat.

## Context

- Gemma 4 E2B is a 3.1 GB download and needs about 3 GB of RAM. On a 4 GB phone like the iPhone 13 mini, it is at the edge and slow.
- The developer asked for something smaller and faster, and chose **Qwen**. The other candidates were Llama 3.2 1B and SmolLM2 1.7B.
- **Llama 3.2 1B:** its licence (Llama 3.2 Community Licence) has an acceptable-use policy and a "Built with Llama" notice, both to pass on to users.
- **SmolLM2 1.7B:** English-first.

## Decision

**Qwen3 1.7B instruct, Q4_K_M GGUF by Unsloth:**
- Apache 2.0.
- 1,107,409,472 bytes, SHA-256 `b139949c5bd74937…`.
- Pinned to the Hugging Face commit `d7f544ee…`.
- Run through the same `llama.rn` runtime and the GGUF's own chat template, with `enable_thinking: false`.
- A leading `<think></think>` block is stripped from the stream (`src/ai/thinkFilter.ts`).

Memory tiers (`memoryFit`) move down accordingly:
- 4 GB phones (3.3 GiB and up reported): ok, no warning.
- 3 GB phones: confirm first.
- Smaller phones: no chat.

The Gemma 4 file is added to `RETIRED_FILES`, so it is deleted on sight.

## Evidence (2026-10-12, M1 Mac, llama.cpp `llama-server`, Metal)

The Prof. Larva system prompt, "Always reply in <language>. Keep replies short", two questions per language. Settings as the app's: temperature 0.8, top-p 0.95, thinking off.

| | Qwen3 1.7B | Qwen 2.5 1.5B |
|---|---|---|
| English | fluent; "do spiders have bones?" right (exoskeleton, chitin); "why are ladybirds red?" wrong (says camouflage) | short, partly wrong ("most spiders have internal skeletons") |
| Polish | fluent but factually wrong ("pająki mają kości") | mostly nonsense |
| German | fluent-ish, some invented words and facts | nonsense |
| Spanish | fluent; bones right; ladybirds partly wrong, with invented details | rude or nonsense |
| Speed | 44 tok/s on the M1 (not the phone) | similar |

Qwen3 1.7B is clearly better than Qwen 2.5 1.5B, so the spec's fallback is not taken.

## Consequences

- **Download:** 1.1 GB instead of 3.1 GB. About 1.5 GB of RAM instead of 3 GB. Chat works without a warning on 4 GB phones.
- **Quality is lower than Gemma 4 E2B,** especially for facts and in Polish and German. The guides can confidently state wrong facts. Options if that matters more than size:
  - ground replies in the pack's species facts (inject the species' `facts` into the system prompt when a species is the topic);
  - offer Gemma 4 E2B as an optional bigger model on 6 GB+ phones (the update/manifest work in spec §8.4 makes a second model entry cheap);
  - try Qwen3 4B on 6 GB+ phones.
- **Still to measure:** the phone check (load time, tokens/s, no memory kill on the iPhone 13 mini).
- The credits and open-source licences screens name Qwen3 1.7B (© Alibaba Cloud / Qwen team, Apache 2.0).

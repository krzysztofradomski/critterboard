# ADR 009 — Chat runs on Apple Intelligence

`#adr` `#ml` `#chat` `#ios`

**Status:** accepted (13 Oct 2026). Supersedes [[008-qwen3-chat-model]] and the model part of [[005-gemma-4-only-chat]]. Still true from 005: chat is on-device only, with no scripted fallback and no web chat.

## Context

- **Qwen3 1.7B on the iPhone 13 mini** (the developer's test phone, 4 GB of RAM) barely worked: replies were slow and often wrong, Polish was poor, and the phone overheated or froze.
  - The weights are 1.1 GB, plus about 0.5 GB for a 4k context, on a phone where iOS lets an app use roughly 2 GB.
- **No model small enough for a 4 GB phone writes good Polish.** ADR 008's own tests already showed fluent but wrong Polish ("pająki mają kości").
- **Apple ships a ~3B on-device model** with iOS 26, the Foundation Models framework, on Apple Intelligence iPhones. It costs the app no download, no memory and no licence. Apple tunes it for the phone's thermals.

## Decision

- **Chat runs only on Apple's on-device model** (`SystemLanguageModel.default`), through our own small Expo module in `modules/apple-chat`.
  - We wrote it ourselves (~120 lines of Swift) rather than adopt a preview package.
  - JS side: `src/ai/appleChat.ts`. It implements the existing `ChatAdapter` seam, with the same guardrails.
- **The downloaded chat model is gone:**
  - `llama.rn`, the model download, eject/load/delete, and the chat entry in `packs/manifest.json` are removed.
  - On first start, the app deletes any old `.gguf` files (and `chat-model.json`) from `models/`, freeing 1.1–3.1 GB. Vision packs live in `models/packs/` and are untouched.
- **Where chat works** (`chatAvailability`, checked again whenever the app returns to the foreground):

| State | When | What the player sees |
|---|---|---|
| `available` | Apple Intelligence on, app language supported | Chat |
| `notEnabled` | Apple Intelligence off in iOS Settings | Chat buttons; the gate says how to turn it on |
| `notReady` | iOS still downloading Apple's model | Chat buttons; the gate says it will open by itself |
| `language` | App language unsupported (Polish today) | No chat buttons; Brains says chat isn't available in Polish yet |
| `device` | iPhone without Apple Intelligence, iOS < 26, Android, web | No chat buttons; Brains says chat needs an iPhone 15 Pro or later |

- **Languages are checked at runtime** (`supportsLocale`), not hard-coded, so Polish turns on by itself if Apple adds it.
- **One fresh session per reply.**
  - The persona, the reply language and the topic go in the instructions.
  - The last 8 turns go into the prompt as text.
  - Replies are capped at 300 tokens, at temperature 0.8.
- **Errors map to short codes** (`guardrail`, `language`, `context`, `other`), shown as friendly persona-voice lines.

## Evidence (13 Oct 2026, M1 Mac, macOS 26.6)

- `supportsLocale`: en ✓, de ✓, es ✓, **pl ✗**.
- Apple's list (support.apple.com/121115, 14 Sep 2026) also has no Polish.
- Devices (same page): iPhone 15 Pro / Pro Max, iPhone 16 and later, iPhone Air.

## Consequences

- **Most phones have no chat:** iPhone 15 and older (including the 13 mini), Android and web. In Polish, chat is off even on new iPhones.
  - Chat is an extra; scanning, the Dex, quests and the map don't depend on it.
- **Nobody downloads a chat model**, and nothing loads one into memory. The app gets smaller (no llama.cpp framework).
- **Quality:**
  - Apple's model is larger and better tuned than Qwen3 1.7B.
  - It can still state wrong facts. Grounding replies in the pack's species facts is the next step if that matters.
- **Testing:** the developer's phone can't run it.
  - It needs the simulator on a Mac with Apple Intelligence turned on, or an iPhone 15 Pro+ tester.
- **Android:** Gemini Nano (ML Kit GenAI, Pixel 9 and some Samsungs) would be the equivalent. It's not built.
- **Building:**
  - The Swift is behind `#if canImport(FoundationModels)` and `@available(iOS 26, *)`, so the deployment target stays iOS 17.
  - The iOS 27 error type is only compiled with Swift 6.4+ (Xcode 27); older Xcodes build without it.

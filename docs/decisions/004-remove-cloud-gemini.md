# ADR 004 — Remove the cloud Gemini proof-of-concept

`#adr` `#ai` `#privacy`

> See also: [[../ml-roadmap]], [[../architecture]], [[002-backend-adapter-seam]].

## Context

Chat and vision had a cloud fallback: Google Gemini via the AI SDK (`ai` + `@ai-sdk/google`). It was meant as a temporary proof-of-concept until on-device models shipped.

- **Vision** now runs on the phone: the eu-ce pack's `eu-1k-commercial-v1` ExecuTorch model covers 1,000 species.
- **Chat** can run on the phone (Gemma via `llama.rn`, or the browser's built-in model on web).
- The cloud path contradicted the app's "no cloud" promise. Its client-side fallback put an API key in the app bundle. Without a key it silently fell back to a **mock that showed made-up scan results**.

## Decision

Remove the cloud Gemini integration entirely:

- **Deleted:** `geminiVision.ts`, `toolChatAdapter.ts`, `tools.ts` (tool calling only worked with Gemini), the Gemini chat adapter, cloud thread summaries, and the Gemini evals (`evals/`).
- **Dependencies dropped:** `ai`, `@ai-sdk/google`, `zod`, `evalite`, `autoevals`.
- **Scan on a phone** classifies only with the on-device model.
  - With no species pack installed, it shows "install the Central Europe pack" with a button to Settings.
  - While the model loads, a toast asks the user to try again. It never shows invented results.
  - The **web preview** keeps the mock, because ExecuTorch can't run in a browser.
- **Chat** uses the on-device model when the user turns it on in Settings (which downloads it). Otherwise the persona gives scripted replies, with a message that says so.
- **Kept:** Chrome's built-in model on web (`webNativeLlm.ts`, "Gemini Nano"). It runs inside the browser on the device and needs no key or server.

## Consequences

- Nothing a user types or photographs leaves the device. The only network calls left are the opt-in ones: packs, the map, Sentry and the social backend.
- Chat loses tool calling (live stats, quests, leaderboard lookups) until an on-device model can do it reliably. The recoverable code is in git history before this change.
- Scanning needs the species pack (~89 MB) once. The app now says so up front.

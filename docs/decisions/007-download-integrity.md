# ADR 007 — Download integrity: pinned size + MD5, commit-pinned URLs

`#decision` `#security` `#networking`

## Context

The app downloads large files and hands them to native parsers: the region model (`.pte`, ~88 MB, ExecuTorch), the offline map (PMTiles, ~56 MB, MapLibre), the species icon atlas, and the chat model (GGUF, 3.1 GB, llama.cpp). A review (2026-10-02) found:

- The region model was written straight over the installed file with no HTTP status check. An error page, or an update cut off halfway, replaced a working model, and because the file then "existed" it was never fetched again.
- Nothing was checked against a known size or hash. The chat model came from a third-party Hugging Face repo's `main` branch, which its owner can change at any time.
- The map's "truncated download" check only read the 127-byte header, which a cut-off file still has.

## Decision

- **One download path** (`src/lib/download.ts`, `downloadFile`) for model, map, icons and chat model: bytes go to `<dest>.part`; it must answer 2xx, match the expected size and MD5, and pass an optional format check; only then does it replace `<dest>`. Anything else throws and leaves the previous file in place. Plain HTTP is refused outside development.
- **Pins live in the pack JSON**: `modelBytes`/`modelMd5`, `mapBytes`/`mapMd5`, `icons.bytes`/`icons.md5`, written by `tools/packs/pin_checksums.py` from the committed files. A unit test fails when a pin no longer matches its file. A changed model checksum at the same URL triggers a re-download.
- **The chat model URL is pinned to a commit** (`resolve/<sha>/…`) with its exact byte count in `CHAT_MODEL.bytes`.
- **Maps must be whole**: the PMTiles header's four section offsets give the size the file must reach (`pmtilesEnd`).

### Why MD5, not SHA-256

expo-file-system computes MD5 natively and streams the file; it has no SHA-256. Hashing in JS would mean reading 88 MB (and 3 GB for chat) into memory. MD5 reliably catches what actually happens (truncation, corruption, a wrong file); deliberate tampering is covered by HTTPS plus URLs that can't change under us (our own repo, a commit-pinned Hugging Face file). For the chat model the size plus commit pin stand in for a hash (no MD5 is published, and 3 GB is too much to hash on every download).

## Consequences

- Changing a model, map or atlas means re-running `pin_checksums.py` and committing the JSON with the file; the test catches a forgotten step.
- Packs installed before the pins existed are not re-downloaded just because the pack JSON gained them.
- Updating the chat model means taking the new commit and size from the Hugging Face API (see the comment on `CHAT_MODEL`).
- Revisit if a native streaming SHA-256 becomes available in Expo.

Related: [[../modules/offline-map]], [[005-gemma-4-only-chat]], [[../architecture]].

# Localization — EN / PL / DE / ES

Source of the request: implement on-device i18n for the four target languages, with a hook for OTA translation pack delivery.

## Plan

- [x] Build `src/i18n/` module: types, registry, translate, loader, helpers, public surface
- [x] Author English source pack (`assets/i18n/en.json`) — every user-facing string across 20 screens + components
- [x] Translate packs into pl / de / es with identical key shape
- [x] Add `language` to `useAppStore` (persisted), expose `setLanguage`
- [x] Wire Settings → Language picker to actually set language
- [x] Refactor `personas/index.ts`: meta stays static, lines/canned/etc. resolved from packs
- [x] Refactor data files (bugs, regions, badges, quests, personProfiles) — keep IDs, move strings to packs
- [x] Replace hardcoded strings with `t()` across every screen + component
- [x] Document architecture in `docs/i18n.md` + add `docs/README.md` index
- [x] `npm run typecheck` clean

## Review

### What landed

- **Tiny custom i18n** (~150 lines across `src/i18n/`) — no new dependencies. `t(lang, key, vars)` imperative + `useT()` hook + `useBugName()`, `countryName()` helpers.
- **4 bundled JSON packs** (`assets/i18n/{en,pl,de,es}.json`) covering every screen + component. English is the source of truth; missing keys fall back to English at lookup time.
- **OTA hook, disabled by default**. `PACK_MANIFEST_URL = null` keeps the loader dormant. Set the URL to enable remote pack downloads cached in AsyncStorage. Manifest schema documented.
- **Language picker wired**. Settings → Language now actually flips the active language. Persisted across launches via the existing zustand `persist` middleware.
- **Data file refactor**. `BUGS`, `REGIONS`, `BADGES`, `QUESTS`, `FRIENDS`, `PERSONAS` strip display strings; IDs remain. Display strings resolve from packs by ID. Latin names, ISO country codes, dates, and usernames stay in source (format-stable or conventionally English).
- **Persona refactor**. `PERSONA_META` is static visual identity. `getPersona(lang, id)` returns a localized `Persona` object with line accessors (`lines.topicHello(topic)`, etc.). `usePersona(id)` hook re-derives on language change.
- **App boot**. `App.tsx` calls `hydrateCachedPacks()` then `syncRemotePacks()` — both no-op silently when the loader is disabled.

### App Store concern (raised mid-flight)

Confirmed App Store-safe: Apple 4.7 only restricts downloading executable code. JSON strings are content, same category as remote config / CMS-driven copy / news feeds. Many major apps do this. The user opted to keep the OTA layer as dormant code; if they change their mind it's ~90 lines + 6 lines in App.tsx to rip out.

### Out of scope

- iOS native locale auto-detection (could read `expo-localization.getLocales()[0].languageCode` on first launch — currently always defaults to English so users opt in via Settings).
- Pluralization rules (current packs use `{n} mutual follow` vs `{n} mutual follows` with two separate keys — fine for now, swap to ICU MessageFormat if quest counts get more complex).
- Translation lint (could add a script that diffs pack keys vs English source and warns on missing ones).
- Right-to-left languages (no Arabic/Hebrew in scope; would need `I18nManager.forceRTL()` wiring and layout review).

### Verification

`npm run typecheck` → clean. Manual key audit via grep confirms no hardcoded user-facing English remains in screens.

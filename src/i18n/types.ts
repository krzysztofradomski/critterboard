/**
 * Shared i18n types.
 *
 * A `Pack` is the JSON shape of a translation file. The English pack is the
 * source of truth — every other pack is keyed identically. Missing keys in a
 * non-English pack fall back to English at lookup time.
 *
 * Packs are typed as `Dict` (recursive string tree) rather than a generated
 * union of every key path. Looser typing on purpose: it lets the JSON files
 * be authored / shipped from a remote pack manifest without TS having to
 * regenerate types between deploys.
 */
export type LangId = 'en' | 'pl' | 'de' | 'es';

export const DEFAULT_LANG: LangId = 'en';

/**
 * Recursive string tree. Leaves are strings; intermediate nodes are
 * nested objects or string arrays (used for ordered lists like region
 * notes and persona canned lines, walked via numeric path segments).
 */
export type Dict = { [key: string]: string | string[] | Dict };

export type Pack = {
  /** Pack format version. Bump if the key tree gains a breaking change. */
  version: number;
  /** ISO 639-1 code matching the filename. */
  lang: LangId;
  /** Native display name shown in the language picker. */
  nativeName: string;
  /** English display name shown under the native one. */
  englishName: string;
  /** Flag emoji shown in the language picker. */
  flag: string;
  /** Nested string tree. */
  strings: Dict;
};

/**
 * Manifest fetched from the remote pack URL. Lets us ship a new translation
 * (or a fixed string) without an app release — the runtime downloads any
 * pack whose `version` exceeds the bundled copy and caches it in
 * AsyncStorage. Bundled packs always work offline; the manifest is a
 * best-effort enrichment.
 */
export type RemotePackManifest = {
  /** Manifest format. Currently `1`. */
  manifest: number;
  /** Per-language entries. Unknown LangIds are ignored. */
  packs: Partial<
    Record<
      LangId,
      {
        version: number;
        /** Absolute URL to a JSON file shaped like `Pack`. */
        url: string;
        /** Optional SHA-256 for integrity check. */
        sha256?: string;
      }
    >
  >;
};

export const LANG_META: Array<{
  id: LangId;
  flag: string;
  native: string;
  english: string;
}> = [
  { id: 'en', flag: '🇬🇧', native: 'English',  english: 'English' },
  { id: 'pl', flag: '🇵🇱', native: 'Polski',   english: 'Polish'  },
  { id: 'de', flag: '🇩🇪', native: 'Deutsch',  english: 'German'  },
  { id: 'es', flag: '🇪🇸', native: 'Español',  english: 'Spanish' },
];

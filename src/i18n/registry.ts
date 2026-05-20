import en from '../../assets/i18n/en.json';
import pl from '../../assets/i18n/pl.json';
import de from '../../assets/i18n/de.json';
import es from '../../assets/i18n/es.json';

import { DEFAULT_LANG, type LangId, type Pack } from './types';

/**
 * In-memory pack registry. Bundled packs are loaded synchronously from JSON
 * so the very first render has translations. The remote loader may overwrite
 * an entry at runtime by calling `registerPack()`.
 */
const PACKS: Record<LangId, Pack> = {
  en: en as Pack,
  pl: pl as Pack,
  de: de as Pack,
  es: es as Pack,
};

const listeners = new Set<() => void>();

export function getPack(lang: LangId): Pack {
  return PACKS[lang] ?? PACKS[DEFAULT_LANG]!;
}

export function getFallbackPack(): Pack {
  return PACKS[DEFAULT_LANG]!;
}

/**
 * Replace a pack in the registry (e.g. after a remote pack download).
 * Notifies subscribers so React components can re-render with the new
 * strings without forcing the user to flip the language toggle.
 */
export function registerPack(pack: Pack): void {
  PACKS[pack.lang] = pack;
  listeners.forEach((cb) => cb());
}

export function subscribePacks(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

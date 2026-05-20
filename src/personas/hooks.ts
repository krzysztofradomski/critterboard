import { useMemo } from 'react';

import { useAppStore } from '@/store/useAppStore';

import { getPersona, PERSONA_IDS, type Persona, type PersonaId } from './index';

/**
 * React hook returning a fully-localized `Persona` object for the given
 * id, re-derived when the active language changes. Use this from any
 * screen or component that renders persona-flavoured copy.
 */
export function usePersona(id: PersonaId): Persona {
  const lang = useAppStore((s) => s.language);
  return useMemo(() => getPersona(lang, id), [lang, id]);
}

/**
 * Hook returning every persona in display order — used by the picker
 * components that show all three side-by-side.
 */
export function usePersonas(): Persona[] {
  const lang = useAppStore((s) => s.language);
  return useMemo(() => PERSONA_IDS.map((id) => getPersona(lang, id)), [lang]);
}

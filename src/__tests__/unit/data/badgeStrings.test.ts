import { describe, expect, it } from 'vitest';

import { BADGES } from '@/data/badges';
import de from '../../../../assets/i18n/de.json';
import en from '../../../../assets/i18n/en.json';
import es from '../../../../assets/i18n/es.json';
import pl from '../../../../assets/i18n/pl.json';

const LOCALES = { en, de, es, pl } as const;

describe('badge strings', () => {
  for (const [lang, pack] of Object.entries(LOCALES)) {
    it(`${lang}: every badge has a name, description and criteria`, () => {
      const items = pack.strings.badges.items as Record<string, Record<string, string>>;
      for (const b of BADGES) {
        for (const key of ['name', 'desc', 'crit']) {
          expect(items[b.id]?.[key], `${lang} badges.items.${b.id}.${key}`).toBeTruthy();
        }
      }
    });
  }
});

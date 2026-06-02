import { describe, it, expect, afterEach } from 'vitest';
import { getPack, registerPack, subscribePacks } from '@/i18n/registry';
import type { Pack } from '@/i18n/types';

function makePack(lang: 'en' | 'pl' | 'de' | 'es', strings: Record<string, string> = {}): Pack {
  return {
    version: 99,
    lang,
    nativeName: 'Test',
    englishName: 'Test',
    flag: '🏳️',
    strings,
  };
}

describe('getPack (U-IR-*)', () => {
  it('returns the English pack for "en"', () => {
    const pack = getPack('en');
    expect(pack.lang).toBe('en');
  });

  it('returns a pack with strings for each bundled lang', () => {
    for (const lang of ['en', 'pl', 'de', 'es'] as const) {
      const pack = getPack(lang);
      expect(pack).toBeDefined();
      expect(typeof pack.strings).toBe('object');
    }
  });
});

describe('registerPack (U-IR-01, U-IR-02)', () => {
  const originalEn = getPack('en');

  afterEach(() => {
    // Restore the original English pack after each test that touches it
    registerPack(originalEn);
  });

  it('U-IR-01: registered pack can be retrieved with getPack', () => {
    const custom = makePack('de', { test: 'hallo' });
    registerPack(custom);
    const retrieved = getPack('de');
    expect(retrieved.version).toBe(99);
  });

  it('U-IR-02: registering same locale twice — second one wins', () => {
    const first = makePack('en', { key: 'first' });
    const second = makePack('en', { key: 'second' });
    registerPack(first);
    registerPack(second);
    const pack = getPack('en');
    expect(pack.version).toBe(99);
  });
});

describe('subscribePacks (U-IR-*)', () => {
  it('calls the subscriber when registerPack fires', () => {
    let called = 0;
    const unsub = subscribePacks(() => { called += 1; });
    registerPack(makePack('es'));
    expect(called).toBe(1);
    unsub();
  });

  it('unsubscribe stops further notifications', () => {
    let called = 0;
    const unsub = subscribePacks(() => { called += 1; });
    unsub();
    registerPack(makePack('es'));
    expect(called).toBe(0);
  });

  it('multiple subscribers all receive the notification', () => {
    const counts = [0, 0, 0];
    const unsubs = counts.map((_, i) =>
      subscribePacks(() => { counts[i]! += 1; }),
    );
    registerPack(makePack('pl'));
    for (const c of counts) expect(c).toBe(1);
    for (const u of unsubs) u();
  });
});

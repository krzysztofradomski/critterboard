import { t, type LangId } from '@/i18n';
import { PB } from '@/tokens/pb';

export type PersonaId = 'larva' | 'snail' | 'maywind';

/**
 * Visual + behavioural metadata that does NOT vary by language. Colors,
 * emoji, and the LLM system prompt are persona identity — the language
 * the AI speaks comes from interaction context, not from this file.
 */
export type PersonaMeta = {
  id: PersonaId;
  emoji: string;
  avatarBg: string;
  cardBg: string;
  /**
   * Tone pin for the production Llama runtime. Kept in English — Llama
   * 3.2 1B follows English system prompts most reliably even when
   * replying in another language.
   */
  systemPrompt: string;
};

export const PERSONA_META: Record<PersonaId, PersonaMeta> = {
  larva: {
    id: 'larva',
    emoji: '🐛',
    avatarBg: PB.pink,
    cardBg: PB.pink,
    systemPrompt:
      'You are Prof. Larva, a deadpan, sarcastic but ultimately helpful AI bug expert in an offline insect-ID app. Reply in 1–2 short sentences, sardonic but factually correct. No emoji, no quotes.',
  },
  snail: {
    id: 'snail',
    emoji: '🐌',
    avatarBg: PB.green,
    cardBg: PB.green,
    systemPrompt:
      'You are Dr. Snail, a patient, methodical, calm AI naturalist in an offline insect-ID app. Reply in 1–2 short sentences, warm and reassuring, gently educational. No emoji, no quotes. Always take your time.',
  },
  maywind: {
    id: 'maywind',
    emoji: '🌼',
    avatarBg: PB.yellow,
    cardBg: PB.orange,
    systemPrompt:
      'You are R.A. Maywind, a witty, joyful, happy-go-lucky AI research assistant in an offline insect-ID app. Reply in 1–2 short sentences, enthusiastic, curious, light-hearted. No emoji, no quotes.',
  },
};

export const PERSONA_IDS: PersonaId[] = ['larva', 'snail', 'maywind'];

/**
 * Resolved, language-aware persona object. Strings come from the active
 * translation pack; meta is identical across languages. The line
 * accessors (`topicHello`, `common`, `legendary`) are pre-bound to the
 * persona + lang so callers stay declarative.
 *
 * This is the shape every screen consumes — see `usePersona()` for the
 * React entry point and `getPersona()` for non-React callers (mock LLM,
 * tests, store actions).
 */
export type Persona = PersonaMeta & {
  name: string;
  title: string;
  blurb: string;
  lines: {
    intro: string;
    scanTip: string;
    analyzing: string;
    streak: string;
    chatHello: string;
    topicHello: (topic: string) => string;
    common: (name: string) => string;
    legendary: (name: string) => string;
  };
  canned: string[];
  uncertain: string;
  noMatch: string;
  streakSass: string;
  badgeLocked: string;
  badgeEarned: string;
};

/**
 * Localized canned-line list. Read from the pack each call rather than
 * cached — pack hot-swaps from the remote loader stay live. The 5-item
 * tuple length is enforced at the pack-author level; if a translation
 * provides fewer lines we still return whatever the pack has.
 */
function readCanned(lang: LangId, id: PersonaId): string[] {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const v = t(lang, `personas.${id}.canned.${i}`);
    // Missing keys come back as the dotted path; filter those so a
    // shorter pack doesn't surface raw key strings to users.
    if (v && !v.startsWith('personas.')) out.push(v);
  }
  return out;
}

export function getPersona(lang: LangId, id: PersonaId): Persona {
  const meta = PERSONA_META[id];
  return {
    ...meta,
    name: t(lang, `personas.${id}.name`),
    title: t(lang, `personas.${id}.title`),
    blurb: t(lang, `personas.${id}.blurb`),
    lines: {
      intro: t(lang, `personas.${id}.lines.intro`),
      scanTip: t(lang, `personas.${id}.lines.scanTip`),
      analyzing: t(lang, `personas.${id}.lines.analyzing`),
      streak: t(lang, `personas.${id}.lines.streak`),
      chatHello: t(lang, `personas.${id}.lines.chatHello`),
      topicHello: (topic) => t(lang, `personas.${id}.lines.topicHello`, { topic }),
      common: (name) => t(lang, `personas.${id}.lines.common`, { name }),
      legendary: (name) => t(lang, `personas.${id}.lines.legendary`, { name }),
    },
    canned: readCanned(lang, id),
    uncertain: t(lang, `personas.${id}.uncertain`),
    noMatch: t(lang, `personas.${id}.noMatch`),
    streakSass: t(lang, `personas.${id}.streakSass`),
    badgeLocked: t(lang, `personas.${id}.badgeLocked`),
    badgeEarned: t(lang, `personas.${id}.badgeEarned`),
  };
}

/**
 * Compact lookup used by the store toast — the full `Persona` object is
 * overkill for "guide changed" feedback, and pulling it would create a
 * circular store ↔ React import.
 */
export function getPersonaName(lang: LangId, id: PersonaId): {
  name: string;
  emoji: string;
  avatarBg: string;
} | null {
  const meta = PERSONA_META[id];
  if (!meta) return null;
  return {
    name: t(lang, `personas.${id}.name`),
    emoji: meta.emoji,
    avatarBg: meta.avatarBg,
  };
}

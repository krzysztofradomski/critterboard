import { PB } from '@/tokens/pb';

/**
 * Translation-key suffixes. Resolve to `person.friend.{key}` (last caught)
 * and `person.why.{key}` (suggested-reason) in the i18n packs.
 */
export type FriendLastKey =
  | 'atlasMothLast'
  | 'stagBeetleLast'
  | 'bulletAntLast'
  | 'eggCaseLast'
  | 'hoverflyLast'
  | 'ladybirdLast'
  | 'huntsmanLast'
  | 'fieldCricketLast'
  | 'pillbugLast'
  | 'greenflyLast';

export type FriendWhyKey = 'sharedBugs' | 'brooklyn' | 'viaMothwhisperer';

export const friendLastKey = (k: FriendLastKey): string => `person.friend.${k}`;
export const friendWhyKey = (k: FriendWhyKey): string => `person.why.${k}`;

export type PersonProfile = {
  emoji: string;
  color: string;
  /** ISO 3166-1 alpha-2; resolved via `countryName()` for display. */
  country: string;
  city: string;
  joined: string;
  level: number;
  rank: number | string;
  xp: number;
  badge: string;
  /** Translation key suffix under `person.bio.*`. Falls back to defaultBio. */
  bioKey?: string;
  recent: string[];
};

export const PERSON_PROFILES: Record<string, PersonProfile> = {
  mothwhisperer: { emoji: '🌙', color: PB.purple, country: 'JP', city: 'Kyoto',    joined: 'Mar 2024', level: 31, rank: 1,  xp: 48230, badge: '👑', bioKey: 'mothwhisperer', recent: ['atla','lhoc','fire','cica'] },
  bug_dad_42:    { emoji: '🪲', color: PB.green,  country: 'DE', city: 'Hamburg',  joined: 'Jun 2024', level: 27, rank: 2,  xp: 41117, badge: '🥈', bioKey: 'bug_dad_42',    recent: ['rhin','fire','lady','walk'] },
  antqueen:      { emoji: '🐜', color: PB.red,    country: 'BR', city: 'Manaus',   joined: 'Aug 2024', level: 25, rank: 3,  xp: 38950, badge: '🥉', bioKey: 'antqueen',      recent: ['cica','mant','walk','rhin'] },
  chitin_chris:  { emoji: '🥚', color: PB.yellow, country: 'US', city: 'Portland', joined: 'Sep 2024', level: 22, rank: 4,  xp: 31044, badge: '',   bioKey: 'chitin_chris',  recent: ['mant','walk','lady','drag'] },
  wingedfren:    { emoji: '🦋', color: PB.pink,   country: 'CA', city: 'Toronto',  joined: 'Oct 2024', level: 21, rank: 5,  xp: 27800, badge: '',   bioKey: 'wingedfren',    recent: ['mona','hwsp','drag','lady'] },
  you:           { emoji: '⭐', color: PB.yellow, country: 'US', city: 'Brooklyn', joined: 'Apr 2026', level: 12, rank: 6,  xp: 24612, badge: '',   bioKey: 'you',           recent: ['mona','lady','hwsp','drag'] },
  larva_loyd:    { emoji: '🐛', color: PB.orange, country: 'UK', city: 'Bristol',  joined: 'Dec 2024', level: 18, rank: 7,  xp: 21330, badge: '',   bioKey: 'larva_loyd',    recent: ['lady','walk','mona','drag'] },
  molt_master:   { emoji: '🦂', color: PB.blue,   country: 'AU', city: 'Brisbane', joined: 'Jan 2025', level: 17, rank: 8,  xp: 19420, badge: '',   bioKey: 'molt_master',   recent: ['mant','walk','rhin','cica'] },
  cricketwitch:  { emoji: '🦗', color: PB.green,  country: 'US', city: 'Austin',   joined: 'Feb 2025', level: 14, rank: 11, xp: 18420, badge: '',   bioKey: 'cricketwitch',  recent: ['cica','mant','walk','lady'] },
  pillbug_dot:   { emoji: '🥕', color: PB.pink,   country: 'NL', city: 'Utrecht',  joined: 'Mar 2025', level: 11, rank: 18, xp: 14210, badge: '',   bioKey: 'pillbug_dot',   recent: ['walk','lady','drag','mona'] },
  aphid_attic:   { emoji: '🌱', color: PB.cream2, country: 'IE', city: 'Galway',   joined: 'Apr 2025', level:  9, rank: 32, xp:  9120, badge: '',   bioKey: 'aphid_attic',   recent: ['lady','hwsp','drag','mona'] },
};

export type FriendsRow = {
  name: string;
  emoji: string;
  color: string;
  country: string;
  xp: number;
  rank: number;
  delta: string | null;
  /** Display text key for the last-caught label, under `person.friend.*`. */
  lastKey: FriendLastKey;
  when: string;
  catchEmoji: string;
  rel: 'following' | 'follower' | 'suggested';
  /** Translation key suffix for the "why suggested" line, under `person.why.*`. */
  whyKey?: FriendWhyKey;
};

export const FRIENDS: FriendsRow[] = [
  { name: 'mothwhisperer', emoji: '🌙', color: PB.purple, country: 'JP', xp: 48230, rank: 1,  delta: '+0', lastKey: 'atlasMothLast',    when: '2 hr', catchEmoji: '🦋', rel: 'following' },
  { name: 'bug_dad_42',    emoji: '🪲', color: PB.green,  country: 'DE', xp: 41117, rank: 2,  delta: '-1', lastKey: 'stagBeetleLast',   when: '5 hr', catchEmoji: '🪲', rel: 'follower'  },
  { name: 'antqueen',      emoji: '🐜', color: PB.red,    country: 'BR', xp: 38950, rank: 3,  delta: '+1', lastKey: 'bulletAntLast',    when: '1 d',  catchEmoji: '🐜', rel: 'following' },
  { name: 'chitin_chris',  emoji: '🥚', color: PB.yellow, country: 'US', xp: 31044, rank: 4,  delta: '+0', lastKey: 'eggCaseLast',      when: '3 d',  catchEmoji: '🦗', rel: 'following' },
  { name: 'wingedfren',    emoji: '🦋', color: PB.pink,   country: 'CA', xp: 27800, rank: 5,  delta: '+2', lastKey: 'hoverflyLast',     when: '18 m', catchEmoji: '🪰', rel: 'following' },
  { name: 'larva_loyd',    emoji: '🐛', color: PB.orange, country: 'UK', xp: 21330, rank: 7,  delta: '-1', lastKey: 'ladybirdLast',     when: '4 hr', catchEmoji: '🐞', rel: 'following' },
  { name: 'molt_master',   emoji: '🦂', color: PB.blue,   country: 'AU', xp: 19420, rank: 8,  delta: '+3', lastKey: 'huntsmanLast',     when: '6 hr', catchEmoji: '🕷', rel: 'following' },
  { name: 'cricketwitch',  emoji: '🦗', color: PB.green,  country: 'US', xp: 18420, rank: 11, delta: null, lastKey: 'fieldCricketLast', when: '1 hr', catchEmoji: '🦗', rel: 'suggested', whyKey: 'sharedBugs' },
  { name: 'pillbug_dot',   emoji: '🥕', color: PB.pink,   country: 'NL', xp: 14210, rank: 18, delta: null, lastKey: 'pillbugLast',      when: '2 hr', catchEmoji: '🌿', rel: 'suggested', whyKey: 'brooklyn' },
  { name: 'aphid_attic',   emoji: '🌱', color: PB.cream2, country: 'IE', xp:  9120, rank: 32, delta: null, lastKey: 'greenflyLast',     when: '2 d',  catchEmoji: '🐞', rel: 'suggested', whyKey: 'viaMothwhisperer' },
];

export const INITIAL_FOLLOWED: string[] = [
  'mothwhisperer', 'antqueen', 'chitin_chris', 'wingedfren',
  'larva_loyd', 'molt_master',
];

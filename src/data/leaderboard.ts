export type LeaderRow = {
  rank: number;
  name: string;
  xp: number;
  badge: string;
  country: string;
  self?: boolean;
};

/**
 * Invented roster for dev demos only (`EXPO_PUBLIC_DEMO_PEERS=1`). Without the
 * flag the app has no peers until a real backend supplies them; only the
 * "self" slot remains so the user's own row still renders.
 */
const DEMO_LEADERS: LeaderRow[] = [
  { rank: 1, name: 'mothwhisperer', xp: 48230, badge: '👑', country: 'JP' },
  { rank: 2, name: 'bug_dad_42',    xp: 41117, badge: '🥈', country: 'DE' },
  { rank: 3, name: 'antqueen',      xp: 38950, badge: '🥉', country: 'BR' },
  { rank: 4, name: 'chitin_chris',  xp: 31044, badge: '',   country: 'US' },
  { rank: 5, name: 'wingedfren',    xp: 27800, badge: '',   country: 'CA' },
  { rank: 6, name: 'you',           xp: 24612, badge: '',   country: 'US', self: true },
  { rank: 7, name: 'larva_loyd',    xp: 21330, badge: '',   country: 'UK' },
  { rank: 8, name: 'molt_master',   xp: 19420, badge: '',   country: 'AU' },
];

export const LEADERS: LeaderRow[] =
  process.env.EXPO_PUBLIC_DEMO_PEERS === '1'
    ? DEMO_LEADERS
    : DEMO_LEADERS.filter((r) => r.self);

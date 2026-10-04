import { PB } from '@/tokens/pb';

/** Photo-taking tips shared by the Scan tips dialog and the No Match screen. Strings: `noMatch.tip.*`. */
export const PHOTO_TIPS = [
  { emoji: '🔆', titleKey: 'noMatch.tip.lightTitle',    descKey: 'noMatch.tip.lightDesc',    color: PB.yellow },
  { emoji: '🔍', titleKey: 'noMatch.tip.frameTitle',    descKey: 'noMatch.tip.frameDesc',    color: PB.green  },
  { emoji: '🌿', titleKey: 'noMatch.tip.backdropTitle', descKey: 'noMatch.tip.backdropDesc', color: PB.blue   },
  { emoji: '📐', titleKey: 'noMatch.tip.profileTitle',  descKey: 'noMatch.tip.profileDesc',  color: PB.purple },
] as const;

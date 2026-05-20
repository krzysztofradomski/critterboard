import { t, type LangId } from '@/i18n';

/**
 * Render a "{n} min ago" / "{n} hr ago" / "{n}d ago" string for an
 * epoch-ms timestamp, localized via the active i18n pack.
 *
 * Buckets (mirroring how the social apps people are used to bucket it):
 *
 *     0–59 s     → "just now"
 *    1–59 m     → "{n} min ago"
 *    1–23 h     → "{n} hr ago"
 *    ≥ 1 d      → "{n}d ago"
 *
 * Kept dependency-free on purpose — `Intl.RelativeTimeFormat` is fine
 * in modern RN but uses different bucketing rules per locale, which
 * fights the prototype's compact visual style. The translation strings
 * give us the right wording per language without ceding the bucketing.
 */
export function timeAgo(at: number, lang: LangId, now: number = Date.now()): string {
  const deltaMs = Math.max(0, now - at);
  const sec = Math.floor(deltaMs / 1000);
  if (sec < 60) return t(lang, 'activity.when.now');
  const min = Math.floor(sec / 60);
  if (min < 60) return t(lang, 'activity.when.minAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t(lang, 'activity.when.hrAgo', { n: hr });
  const days = Math.floor(hr / 24);
  return t(lang, 'activity.when.daysAgo', { n: days });
}

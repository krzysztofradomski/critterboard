import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { t, type LangId } from '@/i18n';
import { currentStreak, type CatchEvent } from '@/lib/streak';
import type { PersonaId } from '@/personas';

/**
 * Stable id for the scheduled streak notification. Re-using the same id
 * lets us blindly cancel-then-reschedule without ever stacking two.
 */
const NOTIFICATION_ID = 'critterboard:streak-nudge';
const ANDROID_CHANNEL_ID = 'streak-nudge';
const NUDGE_HOUR = 18;

let handlerSet = false;
let channelEnsured = false;

/**
 * One-time setup: declare what happens when a notification lands while
 * the app is in the foreground. We show the banner but don't play a
 * sound — the nudge is meant to be a soft tap on the shoulder, not an
 * interruption.
 */
function setupHandler(): void {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelEnsured) return;
  channelEnsured = true;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Streak nudges',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
    });
  } catch {
    // Channel APIs throw on web / unsupported envs — swallow.
  }
}

function hasCatchToday(events: CatchEvent[], now: number): boolean {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();
  for (const e of events) {
    const ed = new Date(e.at);
    if (ed.getFullYear() === y && ed.getMonth() === m && ed.getDate() === day) return true;
  }
  return false;
}

/**
 * The next local 18:00 — today if we haven't reached it yet, otherwise
 * tomorrow. A user opening the app at 20:00 still gets a sensible
 * "catch one tomorrow" nudge.
 */
function nextNudgeAt(now: number): Date {
  const d = new Date(now);
  d.setHours(NUDGE_HOUR, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d;
}

export type StreakNudgeInputs = {
  catchLog: CatchEvent[];
  persona: PersonaId;
  lang: LangId;
};

/**
 * Cancel any existing scheduled nudge and — if conditions warrant —
 * schedule a fresh one for the next 18:00. Idempotent and safe to call
 * on every relevant state change (app start, catch, persona switch,
 * language flip).
 *
 * Skipped silently when:
 *   - currentStreak < 1 (nothing to protect)
 *   - the user has already caught today (no nudge needed)
 *   - notification permission is not granted
 */
export async function syncStreakNudge(input: StreakNudgeInputs, now: number = Date.now()): Promise<void> {
  setupHandler();
  await ensureAndroidChannel();

  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // No prior scheduled — ignore.
  }

  if (currentStreak(input.catchLog, now) < 1) return;
  if (hasCatchToday(input.catchLog, now)) return;

  let granted = false;
  try {
    granted = (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return;
  }
  if (!granted) return;

  const fireAt = nextNudgeAt(now);
  const title = t(input.lang, 'notify.streak.title');
  const body = t(input.lang, `personas.${input.persona}.streakSass`);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: { title, body, sound: false },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
  } catch {
    // Best-effort — failure here just means no nudge tonight.
  }
}

export async function cancelStreakNudge(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
  } catch {
    // no-op
  }
}

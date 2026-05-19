import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Thin wrapper around expo-haptics that no-ops on web and never throws.
 *
 * Centralizing every haptic call here makes it trivial to:
 *   - Add a global "haptics off" preference later
 *   - Swap to react-native-haptic-feedback if expo-haptics ever lags
 *   - Avoid `Haptics.impactAsync(...)` rejections on platforms where the
 *     module is missing the right binary
 */

function safe<T extends (...args: never[]) => Promise<unknown>>(fn: T) {
  return ((...args) => {
    if (Platform.OS === 'web') return;
    fn(...args).catch(() => {
      /* swallow — haptics are non-essential */
    });
  }) as (...args: Parameters<T>) => void;
}

export const haptics = {
  /** Quick tap — use on every primary press, e.g. shutter. */
  tap: safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium thump — persona switch, toggle. */
  select: safe(() => Haptics.selectionAsync()),
  /** Success flourish — bug catch, quest complete. */
  success: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Warning buzz — no-match, error. */
  warning: safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

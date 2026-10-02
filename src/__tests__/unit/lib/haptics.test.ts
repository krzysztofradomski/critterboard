import { beforeEach, describe, expect, it, vi } from 'vitest';

const { impact } = vi.hoisted(() => ({ impact: vi.fn(() => Promise.resolve()) }));
vi.mock('expo-haptics', () => ({
  impactAsync: impact,
  selectionAsync: impact,
  notificationAsync: impact,
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

import { haptics } from '@/lib/haptics';
import { useAppStore } from '@/store/useAppStore';

const setHaptics = (on: boolean) =>
  useAppStore.setState({ profile: { ...useAppStore.getState().profile, hapticsOn: on } });

describe('haptics', () => {
  beforeEach(() => impact.mockClear());

  it('buzzes when Vibration is on', () => {
    setHaptics(true);
    haptics.tap();
    haptics.select();
    expect(impact).toHaveBeenCalledTimes(2);
  });

  it('stays silent when Vibration is off', () => {
    setHaptics(false);
    haptics.tap();
    haptics.success();
    expect(impact).not.toHaveBeenCalled();
  });
});

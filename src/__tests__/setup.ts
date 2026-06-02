import { vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('expo-file-system', () => ({
  getInfoAsync: vi.fn().mockResolvedValue({ exists: false, size: 0 }),
  deleteAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-notifications', () => ({
  scheduleNotificationAsync: vi.fn().mockResolvedValue('id'),
  cancelScheduledNotificationAsync: vi.fn().mockResolvedValue(undefined),
  getAllScheduledNotificationsAsync: vi.fn().mockResolvedValue([]),
  setNotificationHandler: vi.fn(),
}));

vi.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: vi.fn().mockResolvedValue({ granted: false }),
  getCurrentPositionAsync: vi.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

vi.mock('expo-sharing', () => ({
  shareAsync: vi.fn().mockResolvedValue(undefined),
  isAvailableAsync: vi.fn().mockResolvedValue(true),
}));

vi.mock('expo-camera', () => ({
  useCameraPermissions: vi.fn().mockReturnValue([{ granted: true }, vi.fn()]),
  CameraView: {},
}));

vi.mock('@sentry/react-native', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock('react-native-reanimated', () => ({
  default: {},
  useSharedValue: vi.fn(() => ({ value: 0 })),
  useAnimatedStyle: vi.fn(() => ({})),
  withTiming: vi.fn((v: number) => v),
  withSpring: vi.fn((v: number) => v),
  FadeIn: {},
  FadeOut: {},
}));

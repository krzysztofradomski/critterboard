import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useT } from '@/i18n/helpers';
import { DEFAULT_CREDIT } from '@/lib/contributions';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

/** True while sharing for training is possible: Network on and "Help train the model" on. */
export function useCanShareTraining(): boolean {
  return useAppStore((s) => s.profile.networkOn && s.profile.trainingShareOn);
}

/** "Share this photo for training" tick, next to Add to Dex. Renders nothing when sharing is off. */
export function ShareTick({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const t = useT();
  const can = useCanShareTraining();
  const name = useAppStore((s) => s.profile.name);
  if (!can) return null;
  const credit = !name || name.trim().toLowerCase() === 'you' ? DEFAULT_CREDIT : name.trim();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      hitSlop={6}
    >
      <Text style={styles.box}>{value ? '☑' : '☐'}</Text>
      <Text style={styles.label}>{t('training.tick', { name: credit })}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  box: { fontSize: 20, color: PB.ink },
  label: { flex: 1, fontSize: 13, color: PB.ink },
});

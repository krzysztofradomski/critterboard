import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { useTrainingStats } from '@/backend/hooks';
import { Btn } from '@/components/Btn';
import { SettingToggle } from '@/components/SettingToggle';
import { useT } from '@/i18n/helpers';
import { creditNameFor } from '@/lib/contributions';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

/**
 * Brains → "Help train the model": share labelled photos (CC BY 4.0) for the next species
 * model. Needs Network; the first switch-on explains what is sent. Shows what was shared and
 * waits, and deletes it all.
 */
export function TrainingCard() {
  const t = useT();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const showToast = useAppStore((s) => s.showToast);
  const { waiting, shared, deleteAll } = useTrainingStats();
  const on = profile.trainingShareOn && profile.networkOn;
  const credit = creditNameFor(profile.name ?? '');

  const change = (v: boolean) => {
    if (!v) {
      setProfile({ trainingShareOn: false });
      return;
    }
    Alert.alert(t('training.explainTitle'), t('training.explainBody', { name: credit }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('training.explainCta'), onPress: () => setProfile({ trainingShareOn: true }) },
    ]);
  };

  const confirmDelete = () =>
    Alert.alert(t('training.deleteTitle'), t('training.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('training.deleteCta'),
        style: 'destructive',
        onPress: () =>
          void deleteAll().then((ok) =>
            showToast(ok ? { text: t('training.deleted'), icon: '🗑', bg: PB.ink } : { text: t('training.deleteFailed'), bg: '#e53935' }),
          ),
      },
    ]);

  return (
    <View>
      <SettingToggle
        icon="📸"
        color={PB.yellow}
        label={t('training.label')}
        desc={!profile.networkOn ? t('training.needsNetwork') : on ? t('training.on', { name: credit }) : t('training.off')}
        value={on}
        onChange={change}
        disabled={!profile.networkOn}
      />
      {(on || waiting > 0 || (shared ?? 0) > 0) && (
        <View style={styles.stats}>
          <Text style={styles.statsText}>
            {t('training.stats', { shared: shared ?? '–', waiting })}
          </Text>
          <Btn bg={PB.cream} onPress={confirmDelete}>{t('training.deleteCta')}</Btn>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, marginBottom: 4 },
  statsText: { flex: 1, fontSize: 12, color: PB.ink, opacity: 0.8 },
});

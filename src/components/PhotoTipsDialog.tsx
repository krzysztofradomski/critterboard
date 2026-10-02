import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { ModalShell } from '@/components/ModalShell';
import { PHOTO_TIPS } from '@/data/photoTips';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';

/** Tips for taking a photo the model can identify; opened from the Scan screen. */
export function PhotoTipsDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View style={{ padding: 18 }}>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.title}>{t('scan.tipsTitle')}</Text>
            <Text style={styles.sub}>{t('scan.tipsSub')}</Text>
          </View>
          <IconBtn onPress={onClose} size={32} fs={14}>✕</IconBtn>
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          {PHOTO_TIPS.map((tip) => (
            <View key={tip.titleKey} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: tip.color }]}>
                <Text style={{ fontSize: 20 }}>{tip.emoji}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.tipTitle}>{t(tip.titleKey)}</Text>
                <Text style={styles.tipDesc}>{t(tip.descKey)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Btn full bg={PB.ink} color={PB.yellow} onPress={onClose}>{t('scan.tipsGotIt')}</Btn>
        </View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', color: PB.ink },
  sub: { fontSize: 12, color: PB.ink, opacity: 0.65, fontWeight: '600', marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: { fontSize: 14, fontWeight: '800', color: PB.ink },
  tipDesc: { fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 1 },
});

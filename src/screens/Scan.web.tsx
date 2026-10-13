import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';

/** Web: the camera library (VisionCamera, Nitro) and the model are phone-only, so Scan explains that. */
export function Scan() {
  const { back } = useNav();
  const t = useT();
  return (
    <View style={styles.root}>
      <IconBtn onPress={back}>←</IconBtn>
      <Sticker bg={PB.cream} rotate={-1} style={styles.card}>
        <Text style={styles.title}>{t('scan.webOnlyTitle')}</Text>
        <Text style={styles.body}>{t('scan.webOnlyBody')}</Text>
      </Sticker>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PB.cream, paddingTop: 50, paddingHorizontal: 16 },
  card: { marginTop: 24, padding: 16 },
  title: { fontSize: 18, fontWeight: '800', color: PB.ink },
  body: { marginTop: 6, fontSize: 14, color: PB.ink, opacity: 0.8 },
});

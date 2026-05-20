import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DataRow } from '@/components/DataRow';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const FAQ_IDS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5', 'faq6'] as const;

export function Help() {
  const { back } = useNav();
  const profile = useAppStore((s) => s.profile);
  const dex = useAppStore((s) => s.dex);
  const showToast = useAppStore((s) => s.showToast);
  const wipeAll = useAppStore((s) => s.wipeAll);
  const t = useT();
  const [openId, setOpenId] = useState<string | null>('faq1');
  const [confirmWipe, setConfirmWipe] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{t('help.title')}</Text>
          <Text style={styles.sub}>{t('help.sub')}</Text>
        </View>
        <IconBtn fs={14}>↗</IconBtn>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <Text style={styles.section}>{t('help.section')}</Text>
          {FAQ_IDS.map((id, i) => {
            const open = openId === id;
            return (
              <View
                key={id}
                style={{ borderTopColor: PB.cream2, borderTopWidth: i === 0 ? 0 : 1.5 }}
              >
                <Pressable onPress={() => setOpenId(open ? null : id)} style={styles.faqRow}>
                  <Text style={styles.faqQ}>{t(`help.faq.${id}.q`)}</Text>
                  <View style={[styles.plus, { backgroundColor: open ? PB.yellow : PB.cream }]}>
                    <Text
                      style={[
                        styles.plusText,
                        { transform: [{ rotate: open ? '45deg' : '0deg' }] },
                      ]}
                    >
                      +
                    </Text>
                  </View>
                </Pressable>
                {open && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                    <View style={styles.faqAnswerBox}>
                      <Text style={styles.faqA}>{t(`help.faq.${id}.a`)}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </Sticker>

        <Sticker bg={PB.yellow} rotate={-1} style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={styles.contactIcon}>
              <Text style={{ fontSize: 22 }}>📬</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactTitle}>{t('help.contactTitle')}</Text>
              <Text style={styles.contactDesc}>{t('help.contactDesc')}</Text>
              <Text style={styles.contactEmail}>{t('help.contactEmail')}</Text>
            </View>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={styles.dataHead}>
            <Text style={{ fontSize: 26 }}>💾</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.dataTitle}>{t('help.dataTitle')}</Text>
              <Text style={styles.dataSub}>{t('help.dataSub')}</Text>
            </View>
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            <DataRow
              icon="⬇️"
              color={PB.cream2}
              title={t('help.data.exportDexTitle')}
              desc={t('help.data.exportDexDesc', { n: dex.size })}
              cta={t('help.data.exportDexCta')}
              onPress={() => showToast({ text: t('help.data.exportDexToast'), icon: '⬇️', bg: PB.green })}
            />
            <DataRow
              icon="📷"
              color={PB.cream2}
              title={t('help.data.exportSightTitle')}
              desc={t('help.data.exportSightDesc')}
              cta={t('help.data.exportSightCta')}
              onPress={() => showToast({ text: t('help.data.exportSightToast'), icon: '📷', bg: PB.green })}
            />
            <DataRow
              icon="🧹"
              color={PB.cream2}
              title={t('help.data.clearTitle')}
              desc={t('help.data.clearDesc')}
              cta={t('help.data.clearCta')}
              onPress={() => showToast({ text: t('help.data.clearToast'), icon: '🧹', bg: PB.green })}
            />
            <DataRow
              icon="🔥"
              color={PB.red}
              dark
              title={t('help.data.wipeTitle')}
              desc={t('help.data.wipeDesc')}
              cta={confirmWipe ? t('help.data.wipeConfirmCta') : t('help.data.wipeCta')}
              onPress={() => {
                if (confirmWipe) {
                  // The two-tap pattern from the prototype stays — wipe
                  // is irreversible and the user must confirm. After
                  // this call the next render starts at onboarding.
                  void wipeAll();
                  showToast({ text: t('help.data.wipeToast'), icon: '🔥', bg: PB.red });
                  setConfirmWipe(false);
                } else {
                  setConfirmWipe(true);
                  setTimeout(() => setConfirmWipe(false), 3500);
                }
              }}
            />
          </View>
        </Sticker>

        <Sticker bg={PB.cream2} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={styles.appName}>{t('help.appName')}</Text>
          <Text style={styles.appBuild}>{t('help.appBuild')}</Text>
          <Text style={styles.appSpec}>
            {profile.networkOn ? t('help.appSpecOn') : t('help.appSpecOff')}
          </Text>
        </Sticker>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  head: {
    padding: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    backgroundColor: PB.blue,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: PB.cream, lineHeight: 22 },
  sub: { fontSize: 11, color: PB.cream, opacity: 0.9, marginTop: 2 },
  scroll: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, gap: 12 },
  section: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingBottom: 6,
    fontSize: 10,
    fontWeight: '800',
    color: PB.ink,
    opacity: 0.7,
    letterSpacing: 0.6,
  },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  faqQ: { flex: 1, fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 16 },
  plus: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusText: { fontSize: 14, fontWeight: '800', color: PB.ink },
  faqAnswerBox: {
    padding: 12,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  faqA: { fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  contactTitle: { fontSize: 16, fontWeight: '800', color: PB.ink },
  contactDesc: { fontSize: 12, color: PB.ink, opacity: 0.7, marginTop: 3, fontWeight: '600', lineHeight: 16 },
  contactEmail: { marginTop: 10, fontSize: 12, color: PB.ink, fontWeight: '700' },
  dataHead: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: PB.green,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 15.5,
    borderTopRightRadius: 15.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dataTitle: { fontSize: 16, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  dataSub: { fontSize: 12, color: PB.cream, opacity: 0.92, marginTop: 3, fontWeight: '600' },
  appName: { fontSize: 14, fontWeight: '800', color: PB.ink },
  appBuild: { fontSize: 11, color: PB.ink, opacity: 0.6, marginTop: 4 },
  appSpec: { marginTop: 8, fontSize: 10, color: PB.ink, opacity: 0.55 },
});

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { IconBtn } from '@/components/IconBtn';
import { ModalShell } from '@/components/ModalShell';
import { useT } from '@/i18n/helpers';

type CreditEntry = { key: string; emoji: string; color: string };
type CreditSection = { sectionKey: 'team' | 'models' | 'data'; items: CreditEntry[] };

/**
 * Static credits structure. Names + roles come from translation packs:
 *   credits.<sectionKey>.<key>.name / .role
 */
const CREDITS: CreditSection[] = [
  {
    sectionKey: 'team',
    items: [
      { key: 'mira',  emoji: '🎨', color: PB.pink },
      { key: 'theo',  emoji: '📱', color: PB.blue },
      { key: 'junie', emoji: '🧠', color: PB.purple },
    ],
  },
  {
    sectionKey: 'models',
    items: [
      { key: 'bugnet',   emoji: '👁️', color: PB.blue },
      { key: 'larva',    emoji: '🤖', color: PB.pink },
      { key: 'variants', emoji: '🌼', color: PB.yellow },
    ],
  },
  {
    sectionKey: 'data',
    items: [
      { key: 'iNat', emoji: '🌿', color: PB.green },
      { key: 'gbif', emoji: '🗺️', color: PB.green },
      { key: 'beta', emoji: '✨', color: PB.orange },
    ],
  },
];

export function CreditsDialog({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <ModalShell visible={visible} onClose={onClose} paddingTop={56}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>🪲</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title}>{t('help.appName')}</Text>
          <Text style={styles.sub}>{t('credits.build')}</Text>
        </View>
        <IconBtn onPress={onClose} size={32} fs={14} bg={PB.cream}>✕</IconBtn>
      </View>

      <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 14 }}>
        <View style={styles.intro}>
          <Text style={styles.introText}>{t('credits.intro')}</Text>
        </View>

        {CREDITS.map((section) => (
          <View key={section.sectionKey} style={{ marginTop: 16 }}>
            <Text style={styles.section}>
              {t(`credits.section.${section.sectionKey}`).toUpperCase()}
            </Text>
            <View style={{ gap: 8 }}>
              {section.items.map((p) => (
                <View key={p.key} style={styles.itemRow}>
                  <View style={[styles.itemIcon, { backgroundColor: p.color }]}>
                    <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemName}>
                      {t(`credits.${section.sectionKey}.${p.key}.name`)}
                    </Text>
                    <Text style={styles.itemRole}>
                      {t(`credits.${section.sectionKey}.${p.key}.role`)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.contactBox}>
          <Text style={styles.contactTitle}>{t('credits.contactTitle')}</Text>
          <Text style={styles.contactEmail}>{t('credits.contactEmail')}</Text>
        </View>

        <Text style={styles.footer}>{t('credits.footer')}</Text>
      </ScrollView>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    backgroundColor: PB.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  logoText: { fontSize: 26 },
  title: { fontSize: 22, fontWeight: '800', color: PB.ink, lineHeight: 24 },
  sub: { fontSize: 11, color: PB.ink, opacity: 0.7, marginTop: 2 },
  intro: {
    padding: 12,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
  },
  introText: { fontSize: 14, color: PB.ink, fontWeight: '500', lineHeight: 20 },
  section: { fontSize: 11, fontWeight: '800', color: PB.ink, opacity: 0.7, letterSpacing: 0.6, marginBottom: 8 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: { fontSize: 14, fontWeight: '800', color: PB.ink, lineHeight: 15 },
  itemRole: { fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 2 },
  contactBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: PB.green,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  contactTitle: { fontSize: 16, fontWeight: '800', color: PB.cream },
  contactEmail: { fontSize: 12, fontWeight: '600', color: PB.cream, opacity: 0.9, marginTop: 4 },
  footer: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
    fontSize: 10,
    color: PB.ink,
    opacity: 0.55,
    lineHeight: 16,
    textAlign: 'center',
  },
});

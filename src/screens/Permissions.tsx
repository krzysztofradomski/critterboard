import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { Sticker } from '@/components/Sticker';
import { useT } from '@/i18n/helpers';
import { haptics } from '@/lib/haptics';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Choice = 'allow' | 'skip' | null;

type PermissionItem = {
  id: 'camera' | 'location' | 'notifs';
  emoji: string;
  color: string;
  /** Required status key under `permissions.need.*` */
  needKey: 'required' | 'recommended' | 'optional';
  required: boolean;
};

const ITEMS: PermissionItem[] = [
  { id: 'camera',   emoji: '📷', color: PB.green,  needKey: 'required',    required: true  },
  { id: 'location', emoji: '📍', color: PB.blue,   needKey: 'recommended', required: false },
  { id: 'notifs',   emoji: '🔔', color: PB.orange, needKey: 'optional',    required: false },
];

export function Permissions() {
  const { go } = useNav();
  const showToast = useAppStore((s) => s.showToast);
  const setOnboarded = useAppStore((s) => s.setOnboarded);
  const t = useT();
  const [camera, setCamera] = useState<Choice>(null);
  const [location, setLocation] = useState<Choice>(null);
  const [notifs, setNotifs] = useState<Choice>(null);

  const values: Record<PermissionItem['id'], Choice> = useMemo(
    () => ({ camera, location, notifs }),
    [camera, location, notifs],
  );

  const setValue = (id: PermissionItem['id'], v: Choice) => {
    if (id === 'camera') setCamera(v);
    if (id === 'location') setLocation(v);
    if (id === 'notifs') setNotifs(v);
  };

  /**
   * "Allow" doesn't just paint a green pill — it triggers the OS-level
   * prompt. If the user denies at the OS layer we still mark our UI as
   * 'skip' so the flow can continue. Camera being denied is the only
   * hard blocker for the Continue button.
   */
  const requestPermission = async (id: PermissionItem['id']) => {
    haptics.tap();
    let granted = false;
    try {
      if (id === 'camera') {
        const status = await Camera.requestCameraPermissionsAsync();
        granted = status.granted;
      } else if (id === 'location') {
        const status = await Location.requestForegroundPermissionsAsync();
        granted = status.granted;
      } else {
        const status = await Notifications.requestPermissionsAsync();
        granted = status.granted;
      }
    } catch {
      granted = false;
    }
    setValue(id, granted ? 'allow' : 'skip');
  };

  const cameraAllowed = camera === 'allow';
  const allChosen = camera && location && notifs;
  const ready = !!(cameraAllowed && allChosen);

  const finish = () => {
    // Mark onboarding done so the next cold launch lands on home directly.
    // The `onRehydrateStorage` hook on the store reads this flag.
    setOnboarded(true);
    go('home');
    if (cameraAllowed) {
      showToast({ text: t('permissions.readyToast'), icon: '🪲', bg: PB.green });
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIcon}>
            <Text style={{ fontSize: 22 }}>🔐</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('permissions.title')}</Text>
            <Text style={styles.sub}>{t('permissions.sub')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.dots}>
        {ITEMS.map((it) => {
          const v = values[it.id];
          return (
            <View
              key={it.id}
              style={[
                styles.dot,
                { backgroundColor: v === 'allow' ? PB.green : v === 'skip' ? PB.cream2 : PB.paper },
              ]}
            />
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {ITEMS.map((it) => {
          const v = values[it.id];
          const allowed = v === 'allow';
          const skipped = v === 'skip';
          const decided = allowed || skipped;

          return (
            <Sticker key={it.id} bg={PB.paper} style={[styles.card, decided && { opacity: 0.92 }]}>
              <View style={[styles.cardHead, { backgroundColor: it.color }]}>
                <View style={styles.cardHeadIcon}>
                  <Text style={{ fontSize: 22 }}>{it.emoji}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle}>{t(`permissions.items.${it.id}.title`)}</Text>
                  <Text style={styles.cardNeed}>{t(`permissions.need.${it.needKey}`).toUpperCase()}</Text>
                </View>
                {decided ? (
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: allowed ? PB.green : PB.cream },
                    ]}
                  >
                    <Text style={[styles.statusPillText, { color: allowed ? PB.cream : PB.ink }]}>
                      {allowed ? t('permissions.allowed') : t('permissions.skipped')}
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
                <Text style={styles.desc}>{t(`permissions.items.${it.id}.desc`)}</Text>
                <View style={{ marginTop: 10, gap: 4 }}>
                  {(['b1', 'b2', 'b3'] as const).map((bKey) => (
                    <View key={bKey} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={styles.bulletCheck}>✓</Text>
                      <Text style={styles.bullet}>{t(`permissions.items.${it.id}.${bKey}`)}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.choiceRow}>
                  <Pressable
                    disabled={it.required}
                    onPress={() => setValue(it.id, 'skip')}
                    style={[
                      styles.choiceBtn,
                      {
                        backgroundColor: skipped ? PB.ink : PB.cream,
                        opacity: it.required ? 0.4 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.choiceText, { color: skipped ? PB.cream : PB.ink }]}>
                      {it.required ? t('permissions.requiredBtn') : t('permissions.notNow')}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => requestPermission(it.id)}
                    style={[
                      styles.choiceBtn,
                      { backgroundColor: allowed ? PB.green : it.color },
                    ]}
                  >
                    <Text style={[styles.choiceText, { color: allowed ? PB.cream : PB.ink }]}>{t('permissions.allow')}</Text>
                  </Pressable>
                </View>
              </View>
            </Sticker>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Btn
          full
          bg={ready ? PB.ink : PB.cream}
          color={ready ? PB.yellow : PB.ink}
          size="lg"
          onPress={ready ? finish : undefined}
          disabled={!ready}
        >
          {ready
            ? t('permissions.continue')
            : cameraAllowed
            ? t('permissions.decideRest')
            : t('permissions.cameraRequired')}
        </Btn>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  title: { fontSize: 24, fontWeight: '800', color: PB.ink, lineHeight: 24 },
  sub: { fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 4 },
  dots: { paddingVertical: 6, paddingHorizontal: 18, flexDirection: 'row', gap: 6 },
  dot: { flex: 1, height: 6, borderRadius: 99, borderColor: PB.ink, borderWidth: 1.5 },
  scroll: { paddingHorizontal: 14, paddingVertical: 4, paddingBottom: 14, gap: 12 },
  card: { padding: 0, overflow: 'hidden' },
  cardHead: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardHeadIcon: {
    width: 42,
    height: 42,
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
  cardTitle: { fontSize: 18, fontWeight: '800', color: PB.cream, lineHeight: 18 },
  cardNeed: { fontSize: 11, color: PB.cream, opacity: 0.95, marginTop: 3, fontWeight: '700', letterSpacing: 0.4 },
  statusPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  desc: { fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 18 },
  bulletCheck: { marginTop: 2, fontSize: 10, fontWeight: '800', color: PB.green },
  bullet: { fontSize: 11, color: PB.ink, opacity: 0.75 },
  choiceRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  choiceBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  choiceText: { fontSize: 13, fontWeight: '800' },
  footer: { paddingHorizontal: 14, paddingBottom: 30, paddingTop: 14, borderTopColor: PB.ink, borderTopWidth: 2.5, backgroundColor: PB.cream2 },
});

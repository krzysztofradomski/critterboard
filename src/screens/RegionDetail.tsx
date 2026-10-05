import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

import { BugIcon } from '@/components/BugIcon';
import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { findBug } from '@/data/bugs';
import { REGION_DETAILS, REGIONS } from '@/data/regions';
import { removePackIcons } from '@/data/bugIcons';
import {
  fetchPackManifest, getModelPath, isPackOutdated, removeCachedPack, updatePack,
} from '@/data/regionPacks';
import { removeMapPack } from '@/map/mapPack';
import { useT, useBugName } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

export function RegionDetail() {
  const { go, back } = useNav();
  const t = useT();
  const route = useCurrentRoute();
  const regionId = (route.params as { id?: string } | undefined)?.id ?? 'na-ne';
  const r = REGION_DETAILS[regionId] ?? REGION_DETAILS['na-ne']!;
  const maxCount = Math.max(...r.families.map((f) => f.count));
  const installed = useAppStore((s) => s.installedRegions.includes(r.id));
  const installedVersion = useAppStore((s) => s.installedPackVersions[r.id]);
  const installRegion = useAppStore((s) => s.installRegion);
  const uninstallRegion = useAppStore((s) => s.uninstallRegion);
  const showToast = useAppStore((s) => s.showToast);
  const region = REGIONS.find((x) => x.id === r.id);
  const modelMb = region ? region.size - region.mapSize : r.size;
  // Newer pack in the manifest: its URL. Updating: download progress 0–100.
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [updatePct, setUpdatePct] = useState<number | null>(null);

  useEffect(() => {
    if (!installed) return;
    let live = true;
    void fetchPackManifest().then((m) => {
      const entry = m?.packs[r.id];
      if (live && entry && isPackOutdated(installedVersion, entry.version)) setUpdateUrl(entry.url);
    });
    return () => {
      live = false;
    };
  }, [installed, installedVersion, r.id]);

  const update = async () => {
    const dir = FileSystem.documentDirectory;
    if (!updateUrl || !dir || updatePct !== null) return;
    setUpdatePct(0);
    try {
      const pack = await updatePack(dir, r.id, updateUrl, (pct) => setUpdatePct(Math.floor(pct)));
      installRegion(r.id, pack.labelMap, pack.version);
      setUpdateUrl(null);
      showToast({ text: t('regions.detail.updated'), icon: r.emoji, bg: PB.green });
    } catch {
      showToast({ text: t('regions.detail.updateFailed'), bg: '#e53935' });
    } finally {
      setUpdatePct(null);
    }
  };

  const remove = () =>
    Alert.alert(t('regions.detail.removeTitle'), t('regions.detail.removeBody', { mb: r.size }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('regions.detail.removeCta'),
        style: 'destructive',
        onPress: () => {
          uninstallRegion(r.id);
          void removeCachedPack(r.id);
          void removePackIcons(FileSystem.documentDirectory, r.id);
          void removeMapPack(r.id);
          if (FileSystem.documentDirectory) {
            void FileSystem.deleteAsync(getModelPath(FileSystem.documentDirectory, r.id), { idempotent: true });
          }
          go('settings');
        },
      },
    ]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { backgroundColor: r.color }]}>
        <View style={styles.headRow}>
          <IconBtn onPress={back} bg={PB.cream}>←</IconBtn>
          <Text style={styles.headLabel}>{t('regions.detail.headLabel')}</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.heroRow}>
          <View style={styles.heroEmoji}>
            <Text style={{ fontSize: 36 }}>{r.emoji}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroName}>{t(`regions.list.${r.id}.name`)}</Text>
            <Text style={styles.heroTagline}>{t(`regions.detail.${r.id}.tagline`)}</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.stats}>
          {[
            { k: t('regions.detail.stat.species'), v: r.species.toLocaleString(),  c: PB.green },
            { k: t('regions.detail.stat.size'),    v: `${r.size} MB`,              c: PB.blue },
            { k: t('regions.detail.stat.updated'), v: r.version,                   c: PB.purple },
          ].map((s) => (
            <View key={s.k} style={styles.stat}>
              <Text style={[styles.statLabel, { color: s.c }]}>{s.k}</Text>
              <Text style={styles.statValue}>{s.v}</Text>
            </View>
          ))}
        </View>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <Text style={styles.section}>{t('regions.detail.topFamilies')}</Text>
          <View style={{ gap: 8 }}>
            {r.families.map((f) => (
              <View key={f.key}>
                <View style={styles.familyRow}>
                  <Text numberOfLines={1} style={styles.familyName}>
                    {t(`regions.detail.${r.id}.fam.${f.key}`)}
                  </Text>
                  <Text style={styles.familyCount}>{f.count}</Text>
                </View>
                <View style={styles.familyBar}>
                  <View
                    style={{
                      width: `${(f.count / maxCount) * 100}%`,
                      height: '100%',
                      backgroundColor: f.color,
                    }}
                  />
                </View>
              </View>
            ))}
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={styles.section}>{t('regions.detail.sampleSpecies')}</Text>
            <Text style={styles.sectionMeta}>
              {t('regions.detail.sampleMeta', { n: r.species.toLocaleString() })}
            </Text>
          </View>
          <View style={styles.sampleGrid}>
            {r.samples.map((s) => (
              <SampleRow key={s.id} regionId={r.id} sample={s} onPress={() => go('result', { id: s.id })} />
            ))}
          </View>
        </Sticker>

        <Sticker bg={PB.cream2} style={{ padding: 14 }}>
          <Text style={styles.section}>{t('regions.detail.modelNotes')}</Text>
          {Array.from({ length: r.noteCount }).map((_, i) => (
            <View key={i} style={[styles.note, i === 0 ? { marginTop: 0 } : { marginTop: 6 }]}>
              <Text style={styles.noteBullet}>·</Text>
              <Text style={styles.noteText}>{t(`regions.detail.${r.id}.notes.${i}`)}</Text>
            </View>
          ))}
          <Text style={styles.noteFoot}>{t('regions.detail.foot', { date: r.updated })}</Text>
        </Sticker>

        {installed && updateUrl && (
          <Btn full bg={PB.green} color={PB.cream} onPress={update}>
            {updatePct === null
              ? t('regions.detail.update', { mb: modelMb })
              : t('regions.detail.updating', { pct: updatePct })}
          </Btn>
        )}
        {installed && (
          <Btn full bg={PB.red} color={PB.cream} onPress={remove}>
            {t('regions.detail.remove', { mb: r.size })}
          </Btn>
        )}
      </ScrollView>
    </View>
  );
}

function SampleRow({
  regionId,
  sample,
  onPress,
}: {
  regionId: string;
  sample: { id: string; whyKey: string };
  onPress: () => void;
}) {
  const t = useT();
  const name = useBugName(sample.id);
  const b = findBug(sample.id);
  if (!b) return null;
  return (
    <Pressable onPress={onPress} style={styles.sample}>
      <View style={[styles.sampleArt, { backgroundColor: b.color || PB.cream2 }]}>
        <BugIcon bug={b} size={30} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={styles.sampleName}>{name}</Text>
        <Text numberOfLines={1} style={styles.sampleWhy}>
          {t(`regions.detail.${regionId}.why.${sample.whyKey}`)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: PB.cream, paddingTop: 50 },
  header: { paddingHorizontal: 14, borderBottomColor: PB.ink, borderBottomWidth: 2.5 },
  headRow: { paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: PB.ink, textAlign: 'center', letterSpacing: 0.4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 16 },
  heroEmoji: {
    width: 72,
    height: 72,
    borderRadius: 18,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.cream,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  heroName: { fontSize: 28, fontWeight: '800', color: PB.ink, lineHeight: 28 },
  heroTagline: { fontSize: 13, color: PB.ink, marginTop: 4, fontWeight: '600', opacity: 0.85 },
  scroll: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 30, gap: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    padding: 10,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2.5, height: 2.5 },
    alignItems: 'center',
  },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: 16, fontWeight: '800', color: PB.ink, marginTop: 2 },
  section: { fontSize: 10, fontWeight: '800', color: PB.ink, opacity: 0.7, letterSpacing: 0.6, marginBottom: 10 },
  sectionMeta: { fontSize: 10, color: PB.ink, opacity: 0.55 },
  familyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  familyName: { flex: 1, fontSize: 12, color: PB.ink, fontWeight: '700' },
  familyCount: { fontSize: 11, color: PB.ink, opacity: 0.7, fontWeight: '700', marginLeft: 8 },
  familyBar: {
    height: 10,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 1.5,
    borderRadius: 99,
    overflow: 'hidden',
  },
  sampleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sample: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
  },
  sampleArt: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleName: { fontSize: 12, fontWeight: '800', color: PB.ink, lineHeight: 13 },
  sampleWhy: { fontSize: 9, color: PB.ink, opacity: 0.55, marginTop: 2 },
  note: { flexDirection: 'row', gap: 8 },
  noteBullet: { fontSize: 11, fontWeight: '800', color: PB.ink, opacity: 0.55, width: 14 },
  noteText: { flex: 1, fontSize: 12, color: PB.ink, fontWeight: '600', opacity: 0.85, lineHeight: 16 },
  noteFoot: { marginTop: 10, fontSize: 10, color: PB.ink, opacity: 0.55 },
});

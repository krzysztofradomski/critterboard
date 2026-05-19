import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CreditsDialog } from '@/components/CreditsDialog';
import { PersonaPick } from '@/components/PersonaPick';
import { SettingToggle } from '@/components/SettingToggle';
import { Sticker } from '@/components/Sticker';
import { REGIONS, type Region, type RegionStatus } from '@/data/regions';
import { PERSONAS, PERSONA_IDS } from '@/personas';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type LangId = 'en' | 'es' | 'pt' | 'fr' | 'de' | 'ja';

const LANGUAGES: Array<{ id: LangId; flag: string; label: string; native: string }> = [
  { id: 'en', flag: '🇺🇸', label: 'English',    native: 'English' },
  { id: 'es', flag: '🇪🇸', label: 'Spanish',    native: 'Español' },
  { id: 'pt', flag: '🇧🇷', label: 'Portuguese', native: 'Português' },
  { id: 'fr', flag: '🇫🇷', label: 'French',     native: 'Français' },
  { id: 'de', flag: '🇩🇪', label: 'German',     native: 'Deutsch' },
  { id: 'ja', flag: '🇯🇵', label: 'Japanese',   native: '日本語' },
];

export function Settings() {
  const { go } = useNav();
  const persona = useAppStore((s) => s.persona);
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const P = PERSONAS[persona];

  const [downloading, setDownloading] = useState(true);
  const [pct, setPct] = useState(64);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [lang, setLang] = useState<LangId>('en');
  const [regions, setRegions] = useState<Record<string, RegionStatus>>(() => ({
    'na-ne': 'installed',
    'na-sw': 'available',
    'eu-uk': 'available',
    'eu-md': 'available',
    'sa-am': 'available',
    'oc-au': 'available',
    'as-se': 'available',
  }));
  const downloadHandles = useRef<Record<string, ReturnType<typeof setInterval> | null>>({});

  useEffect(() => {
    setNameDraft(profile.name);
  }, [profile.name]);

  useEffect(() => {
    if (!downloading) return;
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 100) {
          setDownloading(false);
          return 100;
        }
        return p + 1;
      });
    }, 220);
    return () => clearInterval(id);
  }, [downloading]);

  useEffect(
    () => () => {
      Object.values(downloadHandles.current).forEach((h) => h && clearInterval(h));
    },
    [],
  );

  const installedCount = Object.values(regions).filter((s) => s === 'installed').length;
  const totalInstalledMb = REGIONS.reduce(
    (acc, r) => (regions[r.id] === 'installed' ? acc + r.size : acc),
    0,
  );

  const commitName = () => {
    const v = nameDraft.trim().slice(0, 18) || 'you';
    if (v !== profile.name) setProfile({ name: v });
  };

  const startDownload = (region: Region) => {
    const status = regions[region.id];
    if (status === 'installed') {
      setRegions((r) => ({ ...r, [region.id]: 'available' }));
      return;
    }
    if (typeof status === 'object') return;
    setRegions((r) => ({ ...r, [region.id]: { downloading: 0 } }));
    const tickMs = Math.max(40, Math.min(220, region.size * 1.2));
    const handle = setInterval(() => {
      setRegions((prev) => {
        const cur = prev[region.id];
        if (typeof cur !== 'object') return prev;
        const nextPct = cur.downloading + (3 + Math.random() * 7);
        if (nextPct >= 100) {
          const h = downloadHandles.current[region.id];
          if (h) clearInterval(h);
          downloadHandles.current[region.id] = null;
          return { ...prev, [region.id]: 'installed' };
        }
        return { ...prev, [region.id]: { downloading: nextPct } };
      });
    }, tickMs);
    downloadHandles.current[region.id] = handle;
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>On-device Brains</Text>
        <Text style={styles.sub}>Everything runs on your phone. Promise.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <View style={[styles.avatarBig, { backgroundColor: P.avatarBg }]}>
              <Text style={{ fontSize: 22 }}>{P.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Your guide</Text>
              <Text style={styles.cardSub}>{P.title}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {PERSONA_IDS.map((pid) => (
              <PersonaPick key={pid} pid={pid} compact />
            ))}
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View
            style={[
              styles.bandHeader,
              { backgroundColor: profile.networkOn ? PB.orange : PB.green },
            ]}
          >
            <Text style={{ fontSize: 26 }}>👤</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>Profile & Privacy</Text>
              <Text style={styles.bandSub}>
                {profile.networkOn ? 'Some data may leave your device.' : 'Zero data leaves your device.'}
              </Text>
            </View>
          </View>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <Text style={styles.sectionLabel}>DISPLAY NAME</Text>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={styles.nameAvatar}>
                <Text style={styles.nameAvatarText}>{(profile.name[0] ?? '?').toUpperCase()}</Text>
              </View>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                onBlur={commitName}
                onSubmitEditing={commitName}
                placeholder="your trainer name"
                placeholderTextColor={PB.ink + '99'}
                maxLength={18}
                style={styles.nameInput}
              />
            </View>
            <Text style={styles.nameHint}>Shown on the leaderboard and shared sightings.</Text>

            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>PRIVACY</Text>
            <View style={{ gap: 8 }}>
              <SettingToggle
                icon="📡"
                color={PB.orange}
                label="Network access"
                desc={profile.networkOn ? 'Online features available.' : 'Fully offline. Recommended.'}
                value={profile.networkOn}
                onChange={(v) =>
                  setProfile({
                    networkOn: v,
                    ...(v ? {} : { leaderboardOn: false, locationShareOn: false }),
                  })
                }
              />
              <SettingToggle
                icon="🏆"
                color={PB.purple}
                label="Show me on leaderboard"
                desc={profile.networkOn ? 'Your XP & name appear globally.' : 'Requires network access.'}
                value={profile.leaderboardOn && profile.networkOn}
                onChange={(v) => setProfile({ leaderboardOn: v })}
                disabled={!profile.networkOn}
              />
              <SettingToggle
                icon="📍"
                color={PB.blue}
                label="Share spotting locations"
                desc={
                  profile.locationShareOn && profile.networkOn
                    ? 'Pins added to the public map (±500m fuzz).'
                    : 'Your map stays private to this device.'
                }
                value={profile.locationShareOn && profile.networkOn}
                onChange={(v) => setProfile({ locationShareOn: v })}
                disabled={!profile.networkOn}
              />
            </View>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <ModelTile
            icon="👁️"
            color={PB.blue}
            title="BugNet v3"
            meta="Vision · 412 MB · 10,247 species"
            statusText="READY"
            statusBg={PB.green}
            statusFg={PB.cream}
          />
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <ModelTile
            icon="🧠"
            color={PB.pink}
            title="Larva-3B (Q4)"
            meta={`Chat model · ${(1.9 * (pct / 100)).toFixed(1)} / 1.9 GB · ${downloading ? '~2 min left' : 'installed'}`}
            statusText={downloading ? `↓ ${pct}%` : 'READY'}
            statusBg={downloading ? PB.yellow : PB.green}
            statusFg={downloading ? PB.ink : PB.cream}
            progressPct={pct}
            progressColor={PB.pink}
          />
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <ModelTile
            icon="📚"
            color={PB.orange}
            title="Species Database"
            meta="Facts & habitats · 88 MB · v2026.04"
            statusText="READY"
            statusBg={PB.green}
            statusFg={PB.cream}
          />
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={[styles.bandHeader, { backgroundColor: PB.green }]}>
            <Text style={{ fontSize: 26 }}>🗺️</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>Regional packs</Text>
              <Text style={styles.bandSub}>Boosts ID accuracy where you actually are.</Text>
            </View>
            <View style={styles.regionMetaPill}>
              <Text style={styles.regionMetaText}>
                {installedCount}/{REGIONS.length} · {totalInstalledMb} MB
              </Text>
            </View>
          </View>
          <View style={{ padding: 10, gap: 8 }}>
            {REGIONS.map((region) => {
              const status = regions[region.id];
              const isInstalled = status === 'installed';
              const isDownloading = typeof status === 'object';
              const downloadPct = isDownloading ? (status as { downloading: number }).downloading : 0;

              return (
                <Pressable
                  key={region.id}
                  onPress={() => {
                    if (isDownloading) return;
                    if (isInstalled) {
                      go('region', { id: region.id });
                    } else {
                      startDownload(region);
                    }
                  }}
                  style={styles.regionRow}
                >
                  {isDownloading && (
                    <View
                      style={[
                        styles.regionDownloadFill,
                        { width: `${downloadPct}%`, backgroundColor: region.color + '66' },
                      ]}
                      pointerEvents="none"
                    />
                  )}
                  <View style={[styles.regionFlag, { backgroundColor: region.color }]}>
                    <Text style={{ fontSize: 18 }}>{region.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.regionName}>{region.name}</Text>
                    <Text style={styles.regionSub}>
                      {isDownloading
                        ? `Downloading · ${Math.floor(downloadPct)}% · ${region.size} MB`
                        : `${region.sub} · ${region.size} MB`}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.regionStatus,
                      {
                        backgroundColor: isInstalled
                          ? PB.green
                          : isDownloading
                          ? PB.yellow
                          : PB.cream,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.regionStatusText,
                        { color: isInstalled ? PB.cream : PB.ink },
                      ]}
                    >
                      {isInstalled
                        ? '✓ ON DEVICE'
                        : isDownloading
                        ? `${Math.floor(downloadPct)}%`
                        : '↓ GET'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.regionFoot}>
              Packs run fully offline. Tap an installed pack to see what's inside.
            </Text>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={[styles.bandHeader, { backgroundColor: PB.purple }]}>
            <Text style={{ fontSize: 26 }}>💬</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>Language</Text>
              <Text style={styles.bandSub}>
                For UI, species names, and {P.name.split(' ').pop()}'s sass.
              </Text>
            </View>
          </View>
          <View style={styles.langGrid}>
            {LANGUAGES.map((L) => {
              const active = lang === L.id;
              return (
                <Pressable
                  key={L.id}
                  onPress={() => setLang(L.id)}
                  style={[
                    styles.langCell,
                    {
                      backgroundColor: active ? PB.green : PB.cream,
                      shadowOffset: active ? { width: 2, height: 2 } : { width: 1.5, height: 1.5 },
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{L.flag}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.langNative, { color: active ? PB.cream : PB.ink }]}>
                      {L.native}
                    </Text>
                    <Text
                      style={[
                        styles.langLabel,
                        { color: active ? PB.cream : PB.ink, opacity: active ? 0.85 : 0.55 },
                      ]}
                    >
                      {L.label}
                    </Text>
                  </View>
                  {active && <Text style={{ color: PB.cream, fontWeight: '800', fontSize: 14 }}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Sticker>

        <View style={styles.quickRow}>
          <Sticker bg={PB.pink} style={styles.quickTile} onPress={() => go('friends')}>
            <Text style={{ fontSize: 26 }}>🐜</Text>
            <Text style={styles.quickTitle}>Naturalists</Text>
            <Text style={styles.quickSub}>Friends & follows</Text>
          </Sticker>
          <Sticker bg={PB.blue} style={styles.quickTile} onPress={() => go('help')}>
            <Text style={{ fontSize: 26 }}>📖</Text>
            <Text style={styles.quickTitle}>Help & About</Text>
            <Text style={styles.quickSub}>FAQ · data export</Text>
          </Sticker>
        </View>

        <Sticker bg={PB.yellow} rotate={-1} style={styles.creditsCard} onPress={() => setCreditsOpen(true)}>
          <Text style={styles.creditsTitle}>Free forever. No ads. No tracking.</Text>
          <Text style={styles.creditsSub}>Built with love by 3 people who really like beetles.</Text>
          <Text style={styles.creditsCta}>VIEW CREDITS →</Text>
        </Sticker>
      </ScrollView>

      <CreditsDialog visible={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </View>
  );
}

function ModelTile({
  icon,
  color,
  title,
  meta,
  statusText,
  statusBg,
  statusFg,
  progressPct,
  progressColor,
}: {
  icon: string;
  color: string;
  title: string;
  meta: string;
  statusText: string;
  statusBg: string;
  statusFg: string;
  progressPct?: number;
  progressColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <View style={[styles.modelIcon, { backgroundColor: color }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={styles.modelTitle}>{title}</Text>
          <View style={[styles.modelStatus, { backgroundColor: statusBg }]}>
            <Text style={[styles.modelStatusText, { color: statusFg }]}>{statusText}</Text>
          </View>
        </View>
        <Text style={styles.modelMeta}>{meta}</Text>
        {typeof progressPct === 'number' && (
          <View style={styles.modelBar}>
            <View
              style={{
                width: `${progressPct}%`,
                height: '100%',
                backgroundColor: progressColor ?? PB.pink,
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 14 },
  title: { fontSize: 30, fontWeight: '800', color: PB.ink, lineHeight: 30 },
  sub: { fontSize: 13, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 4 },
  scroll: { paddingHorizontal: 14, paddingBottom: 130, gap: 12 },
  avatarBig: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PB.ink },
  cardSub: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 2 },
  bandHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 15.5,
    borderTopRightRadius: 15.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bandTitle: { fontSize: 16, fontWeight: '800', color: PB.cream, lineHeight: 16 },
  bandSub: { fontSize: 12, color: PB.cream, opacity: 0.9, marginTop: 3, fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: PB.ink, opacity: 0.65, letterSpacing: 0.6, marginBottom: 6 },
  nameAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  nameAvatarText: { fontSize: 16, fontWeight: '800', color: PB.ink },
  nameInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '700',
    color: PB.ink,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  nameHint: { marginTop: 6, fontSize: 10, color: PB.ink, opacity: 0.55 },
  modelIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  modelTitle: { fontSize: 16, fontWeight: '800', color: PB.ink },
  modelStatus: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  modelStatusText: { fontSize: 10, fontWeight: '800' },
  modelMeta: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 2 },
  modelBar: {
    marginTop: 10,
    height: 12,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    overflow: 'hidden',
  },
  regionMetaPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  regionMetaText: { fontSize: 10, fontWeight: '800', color: PB.ink },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  regionDownloadFill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  regionFlag: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionName: { fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 14 },
  regionSub: { fontSize: 10, color: PB.ink, opacity: 0.65, marginTop: 2 },
  regionStatus: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    minWidth: 56,
    alignItems: 'center',
  },
  regionStatusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  regionFoot: { fontSize: 10, color: PB.ink, opacity: 0.55, padding: 4 },
  langGrid: { padding: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: '47%',
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  langNative: { fontSize: 13, fontWeight: '800', lineHeight: 14 },
  langLabel: { fontSize: 9, marginTop: 1 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickTile: { flex: 1, padding: 14 },
  quickTitle: { marginTop: 6, fontSize: 14, fontWeight: '800', color: PB.cream, lineHeight: 14 },
  quickSub: { marginTop: 3, fontSize: 11, color: PB.cream, opacity: 0.92, fontWeight: '600' },
  creditsCard: { padding: 14, alignItems: 'center' },
  creditsTitle: { fontSize: 18, fontWeight: '800', color: PB.ink, textAlign: 'center' },
  creditsSub: { fontSize: 12, color: PB.ink, opacity: 0.7, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  creditsCta: { marginTop: 8, fontSize: 10, fontWeight: '800', color: PB.ink, opacity: 0.55, letterSpacing: 0.6 },
});

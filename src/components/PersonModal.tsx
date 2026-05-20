import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { ModalShell } from '@/components/ModalShell';
import { BUGS } from '@/data/bugs';
import { PERSON_PROFILES, type PersonProfile } from '@/data/personProfiles';
import { useT, useBugName, countryName } from '@/i18n/helpers';
import { useAppStore } from '@/store/useAppStore';

const DEFAULT_PROFILE: PersonProfile = {
  emoji: '🐛',
  color: PB.cream2,
  country: '—',
  city: '—',
  joined: '—',
  level: 1,
  rank: '—',
  xp: 0,
  badge: '',
  recent: [],
};

export function PersonModal({
  name,
  visible,
  onClose,
  onToggleFollow,
  isFollowed,
  mutuals,
}: {
  name: string | null;
  visible: boolean;
  onClose: () => void;
  onToggleFollow?: () => void;
  isFollowed?: boolean;
  mutuals?: number;
}) {
  const t = useT();
  const language = useAppStore((s) => s.language);
  if (!name) return null;
  const p = PERSON_PROFILES[name] ?? DEFAULT_PROFILE;

  const bio = p.bioKey ? t(`person.bio.${p.bioKey}`) : t('person.defaultBio');

  return (
    <ModalShell visible={visible} onClose={onClose} paddingTop={56}>
      <View style={[styles.header, { backgroundColor: p.color }]}>
        <View style={styles.headerTop}>
          <View style={styles.rankPill}>
            <Text style={styles.rankText}>
              {t('person.rank', { rank: p.rank })}{p.badge ? ` ${p.badge}` : ''}
            </Text>
          </View>
          <IconBtn onPress={onClose} size={30} fs={13} bg={PB.cream}>✕</IconBtn>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{p.emoji}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.name}>{name}</Text>
            <Text style={styles.location}>
              {t('person.location', {
                city: p.city,
                country: countryName(language, p.country),
                level: p.level,
              })}
            </Text>
            <Text numberOfLines={1} style={styles.bio}>{bio}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statStrip}>
        {[
          { k: t('person.stat.xp'),     v: p.xp >= 1000 ? `${(p.xp / 1000).toFixed(1)}k` : String(p.xp), c: PB.orange },
          { k: t('person.stat.caught'), v: p.recent.length ? String(p.recent.length * 38) : '—',          c: PB.green  },
          { k: t('person.stat.joined'), v: p.joined,                                                       c: PB.blue   },
        ].map((s, i) => (
          <View key={s.k} style={[styles.stat, i < 2 && styles.statBorder]}>
            <Text style={[styles.statLabel, { color: s.c }]}>{s.k}</Text>
            <Text style={styles.statValue}>{s.v}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 14 }}>
        <Text style={styles.section}>{t('person.recentCatches')}</Text>
        {p.recent.length > 0 ? (
          <View style={styles.recentRow}>
            {p.recent.slice(0, 4).map((bid, i) => (
              <RecentCell key={i} bugId={bid} />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>{t('person.noCatches')}</Text>
        )}

        {typeof mutuals === 'number' && mutuals > 0 && (
          <View style={styles.mutualBox}>
            <View style={styles.mutualAvatars}>
              {[PB.pink, PB.green, PB.purple].slice(0, Math.min(3, mutuals)).map((c, i) => (
                <View
                  key={i}
                  style={[
                    styles.mutualAvatar,
                    { backgroundColor: c, marginLeft: i === 0 ? 0 : -8 },
                  ]}
                >
                  <Text style={{ fontSize: 11 }}>🐛</Text>
                </View>
              ))}
            </View>
            <Text style={styles.mutualText}>
              {mutuals === 1 ? t('person.mutualOne', { n: mutuals }) : t('person.mutualMany', { n: mutuals })}
            </Text>
          </View>
        )}

        <View style={{ marginTop: 14, gap: 8 }}>
          {name !== 'you' && onToggleFollow && (
            <Btn full bg={isFollowed ? PB.cream : PB.green} color={isFollowed ? PB.ink : PB.cream} onPress={onToggleFollow}>
              {isFollowed ? t('friends.following') : t('friends.follow')}
            </Btn>
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn bg={PB.cream} color={PB.ink} size="sm" style={{ flex: 1 }}>
              {t('person.catchesOnMap')}
            </Btn>
            <Btn bg={PB.cream} color={PB.ink} size="sm" style={{ flex: 1 }}>
              {t('person.theirDex')}
            </Btn>
          </View>
          {name !== 'you' && <Text style={styles.blockText}>{t('person.blockReport')}</Text>}
        </View>
      </ScrollView>
    </ModalShell>
  );
}

function RecentCell({ bugId }: { bugId: string }) {
  const name = useBugName(bugId);
  const b = BUGS.find((x) => x.id === bugId);
  if (!b) return null;
  const short = name.split(' ')[0] ?? name;
  return (
    <View style={styles.recentCell}>
      <View style={[styles.recentArt, { backgroundColor: b.color ?? PB.cream2 }]}>
        <Text style={{ fontSize: 22 }}>{b.emoji}</Text>
      </View>
      <Text numberOfLines={1} style={styles.recentName}>{short}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between' },
  rankPill: {
    paddingVertical: 3,
    paddingHorizontal: 9,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  rankText: { fontSize: 10, fontWeight: '800', color: PB.ink, letterSpacing: 0.5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 20,
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
  avatarText: { fontSize: 36 },
  name: { fontSize: 22, fontWeight: '800', color: PB.ink, lineHeight: 24 },
  location: { fontSize: 11, color: PB.ink, opacity: 0.75, marginTop: 4, fontWeight: '700' },
  bio: { fontSize: 12, color: PB.ink, fontWeight: '600', opacity: 0.85, marginTop: 6 },
  statStrip: { flexDirection: 'row', borderBottomColor: PB.ink, borderBottomWidth: 2.5 },
  stat: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' },
  statBorder: { borderRightColor: PB.ink, borderRightWidth: 1.5, borderStyle: 'dashed' },
  statLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontWeight: '800', color: PB.ink, marginTop: 2 },
  section: { fontSize: 10, fontWeight: '800', color: PB.ink, opacity: 0.7, letterSpacing: 0.6, marginBottom: 8 },
  recentRow: { flexDirection: 'row', gap: 8 },
  recentCell: {
    flex: 1,
    padding: 8,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1.5, height: 1.5 },
  },
  recentArt: {
    height: 40,
    width: '100%',
    borderColor: PB.ink,
    borderWidth: 1.5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentName: { marginTop: 6, fontSize: 9, fontWeight: '800', color: PB.ink },
  empty: { fontSize: 11, color: PB.ink, opacity: 0.55, fontStyle: 'italic' },
  mutualBox: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mutualAvatars: { flexDirection: 'row' },
  mutualAvatar: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutualText: { fontSize: 12, color: PB.ink, fontWeight: '600' },
  blockText: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 10,
    color: PB.ink,
    opacity: 0.55,
    fontWeight: '700',
  },
});

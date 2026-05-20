import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BadgeDialog } from '@/components/BadgeDialog';
import { CompletedDrawer } from '@/components/CompletedDrawer';
import { QuestCard } from '@/components/QuestCard';
import { QuestDialog } from '@/components/QuestDialog';
import { BADGES, BADGES_TOTAL, type Badge } from '@/data/badges';
import { COMPLETED_QUESTS } from '@/data/quests';
import { useT } from '@/i18n/helpers';
import { useLevel } from '@/lib/level';
import { useQuests } from '@/lib/quests';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

export function Quests() {
  const { go } = useNav();
  const persona = useAppStore((s) => s.persona);
  const P = usePersona(persona);
  const t = useT();
  const level = useLevel();
  const quests = useQuests();

  const [openId, setOpenId] = useState<string | null>(null);
  const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);

  const openQuest = quests.find((q) => q.id === openId) ?? null;
  const openBadge: Badge | null = BADGES.find((b) => b.id === openBadgeId) ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headTop}>
          <View>
            <Text style={styles.title}>{t('quests.title')}</Text>
            <Text style={styles.sub}>{t('quests.sub')}</Text>
          </View>
          <View style={styles.levelBox}>
            <Text style={styles.levelLabel}>{t('quests.levelLabel')}</Text>
            <Text style={styles.levelValue}>{level.level}</Text>
          </View>
        </View>
        <View style={{ marginTop: 14 }}>
          <View style={styles.xpRow}>
            <Text style={styles.xpText}>
              {t('quests.xpCurrentDynamic', { xp: level.xp })}
            </Text>
            <Text style={styles.xpText}>
              {t('quests.xpNextDynamic', { nextXp: level.nextAt, level: level.level + 1 })}
            </Text>
          </View>
          <View style={styles.xpBar}>
            <View
              style={[
                styles.xpFill,
                { width: `${Math.min(100, (100 * level.into) / level.span)}%` },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.list}>
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          <Text style={styles.section}>{t('quests.daily')}</Text>
          {quests.filter((q) => q.kind === 'daily').map((q) => (
            <QuestCard key={q.id} quest={q} accent={PB.green} onPress={() => setOpenId(q.id)} />
          ))}
          <Text style={[styles.section, { marginTop: 16 }]}>{t('quests.weekly')}</Text>
          {quests.filter((q) => q.kind === 'weekly').map((q) => (
            <QuestCard key={q.id} quest={q} accent={PB.purple} onPress={() => setOpenId(q.id)} />
          ))}

          <Text style={[styles.section, { marginTop: 18 }]}>
            {t('quests.badges', { earned: BADGES.filter((b) => b.unlocked).length, total: BADGES_TOTAL })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 6 }}>
            {BADGES.map((b) => (
              <Pressable key={b.id} onPress={() => setOpenBadgeId(b.id)} style={styles.badgeCell}>
                <View
                  style={[
                    styles.badgeBox,
                    {
                      backgroundColor: b.color,
                      opacity: b.unlocked ? 1 : 0.55,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 30 }}>{b.unlocked ? b.icon : '?'}</Text>
                </View>
                <Text numberOfLines={1} style={styles.badgeName}>
                  {b.unlocked ? t(`badges.items.${b.id}.name`) : t('badges.uncaughtName')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <CompletedDrawer
            open={completedOpen}
            onToggle={() => setCompletedOpen((v) => !v)}
            items={COMPLETED_QUESTS}
          />
        </ScrollView>
      </View>

      <QuestDialog
        quest={openQuest}
        persona={P}
        visible={!!openQuest}
        onClose={() => setOpenId(null)}
        onStart={() => {
          setOpenId(null);
          go('scan');
        }}
      />
      <BadgeDialog
        badge={openBadge}
        persona={P}
        visible={!!openBadge}
        onClose={() => setOpenBadgeId(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.red },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 14 },
  headTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: PB.cream, lineHeight: 30 },
  sub: { fontSize: 13, color: PB.cream, opacity: 0.85, fontWeight: '600', marginTop: 4 },
  levelBox: {
    width: 78,
    height: 78,
    borderRadius: 18,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  levelLabel: { fontSize: 11, fontWeight: '800', color: PB.ink, lineHeight: 11 },
  levelValue: { fontSize: 28, fontWeight: '800', color: PB.ink, lineHeight: 28 },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between' },
  xpText: { fontSize: 11, color: PB.cream, opacity: 0.85, fontWeight: '700' },
  xpBar: {
    marginTop: 4,
    height: 14,
    backgroundColor: PB.ink,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 99,
    padding: 2,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  xpFill: { height: '100%', backgroundColor: PB.yellow, borderRadius: 99 },
  list: {
    flex: 1,
    backgroundColor: PB.cream,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    padding: 14,
    marginBottom: 100,
  },
  section: { fontSize: 13, fontWeight: '800', color: PB.ink, letterSpacing: 0.6, marginBottom: 8 },
  badgeCell: { width: 80, alignItems: 'center' },
  badgeBox: {
    width: 70,
    height: 70,
    borderRadius: 16,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  badgeName: { marginTop: 6, fontSize: 10, fontWeight: '800', color: PB.ink, textAlign: 'center' },
});

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Leaderboard } from '@/screens/Leaderboard';
import { Quests } from '@/screens/Quests';
import { Settings } from '@/screens/Settings';
import { TabBar } from '@/components/TabBar';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import type { MeSub } from '@/navigation/routes';
import { useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

const SUBTABS: MeSub[] = ['quests', 'leaderboard', 'settings'];

export function MeHub() {
  const { go } = useNav();
  const t = useT();
  const route = useCurrentRoute();
  const sub: MeSub = ((route.params as { sub?: MeSub } | undefined)?.sub) ?? 'quests';

  return (
    <View style={StyleSheet.absoluteFill}>
      {sub === 'quests' && <Quests />}
      {sub === 'leaderboard' && <Leaderboard />}
      {sub === 'settings' && <Settings />}

      <View style={styles.subtabs}>
        {SUBTABS.map((id) => (
          <Pressable
            key={id}
            onPress={() => go('me', { sub: id })}
            style={[
              styles.subtab,
              { backgroundColor: sub === id ? PB.yellow : 'transparent' },
            ]}
          >
            <Text style={[styles.subtabText, { color: sub === id ? PB.ink : PB.cream }]}>
              {t(`meSub.${id}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <TabBar active="me" />
    </View>
  );
}

const styles = StyleSheet.create({
  subtabs: {
    position: 'absolute',
    top: 50,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    backgroundColor: PB.ink,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    zIndex: 30,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  subtab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  subtabText: { fontSize: 13, fontWeight: '800' },
});

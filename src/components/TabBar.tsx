import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';
import type { MainTab } from '@/navigation/routes';

const TABS: { id: MainTab; icon: string }[] = [
  { id: 'home', icon: '🏠' },
  { id: 'scan', icon: '📷' },
  { id: 'dex',  icon: '📔' },
  { id: 'map',  icon: '🗺️' },
  { id: 'me',   icon: '⭐' },
];

export function TabBar({ active }: { active: MainTab }) {
  const { go } = useNav();
  const t = useT();
  return (
    <View style={styles.bar}>
      {TABS.map((tabDef) => {
        const isActive = active === tabDef.id;
        return (
          <Pressable key={tabDef.id} onPress={() => go(tabDef.id)} style={styles.cell}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isActive ? PB.yellow : PB.cream2,
                  shadowOpacity: isActive ? 1 : 0,
                },
              ]}
            >
              <Text style={styles.iconGlyph}>{tabDef.icon}</Text>
            </View>
            <Text style={styles.label}>{t(`tabs.${tabDef.id}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 28,
    left: 12,
    right: 12,
    height: 70,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 22,
    flexDirection: 'row',
    zIndex: 50,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 6,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  iconGlyph: { fontSize: 20 },
  label: {
    fontSize: 9,
    color: PB.ink,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

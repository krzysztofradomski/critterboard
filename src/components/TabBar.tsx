import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';
import type { MainTab } from '@/navigation/routes';

const TABS: { id: MainTab; label: string; icon: string }[] = [
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'scan', label: 'Scan', icon: '📷' },
  { id: 'dex',  label: 'Dex',  icon: '📔' },
  { id: 'map',  label: 'Map',  icon: '🗺️' },
  { id: 'me',   label: 'Me',   icon: '⭐' },
];

export function TabBar({ active }: { active: MainTab }) {
  const { go } = useNav();
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <Pressable key={t.id} onPress={() => go(t.id)} style={styles.cell}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: isActive ? PB.yellow : PB.cream2,
                  shadowOpacity: isActive ? 1 : 0,
                },
              ]}
            >
              <Text style={styles.iconGlyph}>{t.icon}</Text>
            </View>
            <Text style={styles.label}>{t.label}</Text>
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

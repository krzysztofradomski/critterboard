import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, Pattern, Rect } from 'react-native-svg';

import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { TabBar } from '@/components/TabBar';
import { SIGHTINGS } from '@/data/sightings';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useNav } from '@/store/useNav';

export function MapScreen() {
  const { go } = useNav();
  const t = useT();
  const [selected, setSelected] = useState(2);
  const s = SIGHTINGS[selected]!;

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 360 720">
        <Defs>
          <Pattern id="bgrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <Rect width={32} height={32} fill={PB.blue} />
            <Circle cx={0} cy={0} r={1.5} fill="#fff" opacity={0.3} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#bgrid)" />
        <Path
          d="M 20 100 Q 60 80 120 100 Q 200 130 280 100 Q 340 80 360 120 L 360 320 Q 300 340 220 320 Q 140 300 60 320 Q 20 340 20 320 Z"
          fill={PB.green}
          stroke={PB.ink}
          strokeWidth={3}
        />
        <Path
          d="M 40 480 Q 100 460 200 480 Q 300 500 360 480 L 360 720 L 0 720 L 0 480 Z"
          fill={PB.green}
          stroke={PB.ink}
          strokeWidth={3}
        />
        <Path
          d="M 60 600 Q 140 540 200 460 Q 260 380 200 300 Q 140 240 220 180"
          stroke={PB.yellow}
          strokeWidth={4}
          fill="none"
          strokeDasharray="8 6"
          strokeLinecap="round"
        />
      </Svg>

      {SIGHTINGS.map((sp, i) => (
        <Pressable
          key={i}
          onPress={() => setSelected(i)}
          style={[
            styles.pin,
            { left: `${sp.x}%`, top: `${sp.y}%` },
          ]}
        >
          <View
            style={[
              styles.pinHead,
              {
                width: 38 + sp.size * 4,
                height: 38 + sp.size * 4,
                backgroundColor: selected === i ? PB.yellow : PB.cream,
                shadowOffset: selected === i ? { width: 3, height: 3 } : { width: 2, height: 2 },
                transform: selected === i ? [{ scale: 1.1 }] : [],
              },
            ]}
          >
            <Text style={{ fontSize: 18 + sp.size * 2 }}>{sp.bug}</Text>
          </View>
          <View style={styles.pinTail} />
        </Pressable>
      ))}

      <View style={styles.youPin}>
        <View style={styles.youPinDot} />
      </View>

      <View style={styles.topbar}>
        <Sticker bg={PB.cream} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.locName}>{t('map.locName')}</Text>
              <Text style={styles.locSub}>{t('map.locSub', { n: SIGHTINGS.length })}</Text>
            </View>
            <IconBtn bg={PB.yellow}>⌖</IconBtn>
          </View>
        </Sticker>
      </View>

      <View style={styles.bottombar}>
        <Sticker bg={PB.cream} style={{ padding: 12 }} onPress={() => go('scan')}>
          <View style={styles.cardRow}>
            <View style={styles.cardArt}>
              <Text style={{ fontSize: 26 }}>{s.bug}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                <Text style={styles.cardTitle}>{t('map.sightings', { n: s.size + 1 })}</Text>
                <Text style={styles.cardDistance}>{t('map.distance')}</Text>
              </View>
              <Text style={styles.cardWhere}>{t('map.where')}</Text>
            </View>
            <View style={styles.huntPill}>
              <Text style={styles.huntPillText}>{t('map.hunt')}</Text>
            </View>
          </View>
        </Sticker>
      </View>

      <TabBar active="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.blue },
  pin: { position: 'absolute', transform: [{ translateX: -19 }, { translateY: -42 }], alignItems: 'center' },
  pinHead: {
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2.5,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopWidth: 7,
    borderTopColor: PB.ink,
    marginTop: -1,
  },
  youPin: {
    position: 'absolute',
    left: '46%',
    top: '52%',
    transform: [{ translateX: -11 }, { translateY: -11 }],
  },
  youPinDot: {
    width: 22,
    height: 22,
    borderRadius: 99,
    backgroundColor: PB.red,
    borderColor: PB.cream,
    borderWidth: 3,
    shadowColor: PB.red,
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  topbar: { position: 'absolute', top: 50, left: 12, right: 12 },
  locName: { fontSize: 18, fontWeight: '800', color: PB.ink, lineHeight: 18 },
  locSub: { fontSize: 11, color: PB.ink, opacity: 0.6, marginTop: 2 },
  bottombar: { position: 'absolute', left: 12, right: 12, bottom: 110 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardArt: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.cream2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: PB.ink },
  cardDistance: { fontSize: 11, color: PB.ink, opacity: 0.6 },
  cardWhere: { fontSize: 13, color: PB.ink, fontWeight: '600' },
  huntPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  huntPillText: { fontSize: 11, fontWeight: '800', color: PB.ink },
});

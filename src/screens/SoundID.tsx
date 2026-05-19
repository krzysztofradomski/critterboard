import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { PERSONAS } from '@/personas';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Phase = 'idle' | 'listening' | 'matched';

const CANDS = [
  { id: 'cica', name: 'Periodical Cicada', emoji: '🦟', color: PB.purple, hint: 'High-pitched buzz · 4–6 kHz' },
  { id: 'mant', name: 'Praying Mantis',    emoji: '🦗', color: PB.green,  hint: 'Soft rasp · close mic' },
  { id: 'fire', name: 'Common Firefly',    emoji: '✨', color: PB.yellow, hint: 'No call · false match' },
];

export function SoundID() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const P = PERSONAS[persona];
  const [phase, setPhase] = useState<Phase>('idle');
  const [secs, setSecs] = useState(0);
  const [topIdx, setTopIdx] = useState(0);
  const secsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const topRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wave = useMemo(() => {
    const arr: number[] = [];
    for (let i = 0; i < 64; i++) {
      arr.push(0.25 + Math.sin(i * 0.5) * 0.15 + Math.random() * 0.4);
    }
    return arr;
  }, [phase]);

  const cleanup = () => {
    if (secsRef.current) clearInterval(secsRef.current);
    if (topRef.current) clearInterval(topRef.current);
    if (stopRef.current) clearTimeout(stopRef.current);
    secsRef.current = null;
    topRef.current = null;
    stopRef.current = null;
  };

  useEffect(() => () => cleanup(), []);

  const start = () => {
    if (phase === 'listening') return;
    setPhase('listening');
    setSecs(0);
    setTopIdx(0);
    secsRef.current = setInterval(() => setSecs((s) => s + 1), 1000);
    let i = 0;
    topRef.current = setInterval(() => {
      i = (i + 1) % CANDS.length;
      setTopIdx(i);
    }, 1400);
    stopRef.current = setTimeout(() => {
      cleanup();
      setPhase('matched');
    }, 6000);
  };

  const stop = () => {
    cleanup();
    setPhase('idle');
    setSecs(0);
  };

  const matched = phase === 'matched';
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');

  return (
    <View style={styles.root}>
      <View style={styles.topbar}>
        <IconBtn onPress={back} size={42} fs={18}>✕</IconBtn>
        <View style={styles.modeSwitch}>
          <Pressable onPress={() => go('scan')} style={[styles.modeCell, styles.modeInactive]}>
            <Text style={styles.modeText}>📷 CAM</Text>
          </Pressable>
          <View style={[styles.modeCell, styles.modeActive]}>
            <Text style={styles.modeText}>🔊 SOUND</Text>
          </View>
        </View>
        <IconBtn size={42} fs={18}>🎚</IconBtn>
      </View>

      <View style={styles.stage}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.stageMeta}>
            {phase === 'listening' ? '● REC' : matched ? '✓ MATCH' : '○ IDLE'} · {mm}:{ss}
          </Text>
          <Text style={styles.stageMeta}>
            {phase === 'listening' ? '−18 dB · 4.2 kHz peak' : '— dB · — kHz'}
          </Text>
        </View>

        <View style={styles.bars}>
          {wave.map((v, i) => {
            const h = phase === 'idle' ? 12 : v * 100;
            const palette = [PB.yellow, PB.pink, PB.green, PB.cream];
            const c = palette[i % palette.length] as string;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  minHeight: 2,
                  backgroundColor: matched ? PB.cream2 : c,
                  borderRadius: 1.5,
                  opacity: phase === 'idle' ? 0.35 : 1,
                }}
              />
            );
          })}
        </View>

        <View style={styles.stageFoot}>
          <Text style={styles.stageStatus}>
            {phase === 'idle' ? 'TAP MIC TO LISTEN' : matched ? 'PROBABLE MATCH FOUND' : 'LISTENING...'}
          </Text>
          <Text style={styles.stageMeta}>BugNet-Audio · 38 MB</Text>
        </View>
      </View>

      <View style={{ marginHorizontal: 14, marginTop: 14 }}>
        <Sticker bg={P.cardBg} rotate={1} style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={[styles.personaAvatar, { backgroundColor: PB.cream }]}>
              <Text style={{ fontSize: 16 }}>{P.emoji}</Text>
            </View>
            <Text style={styles.snark}>
              {phase === 'idle'
                ? P.id === 'larva'
                  ? "Point the phone at the noise. I'll do my actual job."
                  : P.id === 'snail'
                  ? 'Hold the phone steady. A few seconds of clean audio is enough.'
                  : "Ooh ooh — let's hear that buzz!"
                : matched
                ? P.id === 'larva'
                  ? "Top match locked. Don't say I never did anything for you."
                  : P.id === 'snail'
                  ? 'A confident match. Lovely.'
                  : 'NAILED IT! Look at that signal!'
                : P.id === 'larva'
                ? 'Filtering out your breathing. You breathe a lot.'
                : P.id === 'snail'
                ? 'Listening carefully. The pattern is emerging.'
                : 'Picking up something cool — keep going!'}
            </Text>
          </View>
        </Sticker>
      </View>

      <View style={styles.candidates}>
        {CANDS.map((c, i) => {
          const isTop = i === topIdx;
          const baseConf = matched
            ? i === 0
              ? 84
              : i === 1
              ? 41
              : 12
            : phase === 'listening'
            ? isTop
              ? 55 + Math.floor(Math.random() * 15)
              : 20 + i * 5
            : 0;
          return (
            <Pressable
              key={c.id}
              disabled={!matched}
              onPress={() => matched && go('result', { id: c.id })}
              style={[
                styles.candidate,
                {
                  backgroundColor: isTop && phase !== 'idle' ? PB.cream : PB.cream2,
                  shadowOffset:
                    matched && i === 0 ? { width: 3, height: 3 } : { width: 1.5, height: 1.5 },
                  opacity: phase === 'idle' ? 0.5 : 1,
                },
              ]}
            >
              <View style={[styles.candidateIcon, { backgroundColor: c.color }]}>
                <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.candidateName}>{c.name}</Text>
                <Text style={styles.candidateHint}>{c.hint}</Text>
              </View>
              <Text style={[styles.candidateConf, { color: i === 0 && matched ? PB.green : PB.ink }]}>
                {baseConf}%
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.micWrap}>
        <Pressable
          onPress={
            phase === 'listening'
              ? stop
              : matched
              ? () => CANDS[0] && go('result', { id: CANDS[0].id })
              : start
          }
          style={[
            styles.mic,
            { backgroundColor: phase === 'listening' ? PB.red : matched ? PB.green : PB.yellow },
          ]}
        >
          <Text style={styles.micText}>{matched ? '✓' : phase === 'listening' ? '■' : '🎙'}</Text>
        </Pressable>
        <Text style={styles.micLabel}>
          {phase === 'listening' ? 'TAP TO STOP' : matched ? 'TAP TO CONFIRM TOP MATCH' : 'TAP TO LISTEN · UP TO 30s'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.purple, overflow: 'hidden' },
  topbar: { position: 'absolute', top: 50, left: 12, right: 12, flexDirection: 'row', gap: 8, zIndex: 10 },
  modeSwitch: {
    flex: 1,
    height: 42,
    padding: 3,
    backgroundColor: PB.ink,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 3,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  modeCell: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  modeActive: { backgroundColor: PB.yellow },
  modeInactive: { backgroundColor: PB.cream2, opacity: 0.55 },
  modeText: { fontSize: 12, fontWeight: '800', color: PB.ink },
  stage: {
    position: 'absolute',
    top: 110,
    left: 14,
    right: 14,
    height: 220,
    backgroundColor: PB.ink,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 22,
    padding: 16,
    justifyContent: 'space-between',
    shadowColor: PB.cream,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
  },
  stageMeta: { fontSize: 10, color: PB.cream2, opacity: 0.9 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, paddingTop: 12, paddingBottom: 12 },
  stageFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopColor: PB.cream2,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    paddingTop: 10,
  },
  stageStatus: { fontSize: 12, color: PB.cream, fontWeight: '800', letterSpacing: 0.5 },
  personaAvatar: {
    width: 32,
    height: 32,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snark: { flex: 1, fontSize: 13, color: PB.ink, fontWeight: '600', lineHeight: 17 },
  candidates: { position: 'absolute', left: 14, right: 14, top: 432, gap: 8 },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  candidateIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  candidateName: { fontSize: 13, fontWeight: '800', color: PB.ink, lineHeight: 14 },
  candidateHint: { fontSize: 10, color: PB.ink, opacity: 0.6, marginTop: 2 },
  candidateConf: { fontSize: 14, fontWeight: '800', minWidth: 44, textAlign: 'right' },
  micWrap: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  mic: {
    width: 88,
    height: 88,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 5, height: 5 },
  },
  micText: { fontSize: 36 },
  micLabel: { marginTop: 6, fontSize: 11, fontWeight: '800', color: PB.cream, opacity: 0.9, letterSpacing: 0.6 },
});

import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BugIcon } from '@/components/BugIcon';
import { Btn } from '@/components/Btn';
import { CatchPhoto } from '@/components/CatchPhoto';
import { ShareTick, useCanShareTraining } from '@/components/ShareTick';
import type { Aim } from '@/ai/scanCrops';
import { allBugs, findBug, type Bug } from '@/data/bugs';
import { bugName, useT } from '@/i18n/helpers';
import { searchSpecies } from '@/lib/speciesSearch';
import { shareForTraining } from '@/lib/shareTraining';
import { useAddCatch } from '@/lib/useAddCatch';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

const MAX_RESULTS = 60;

/**
 * "Name it yourself": search the region pack's species by name (app language, English or
 * Latin), pick one, confirm, and it goes into the Dex as a self-named catch (no XP, never
 * uploaded). Only offered when there is a photo.
 */
export function NameItSheet({
  visible,
  photoUri,
  top3 = [],
  top3p,
  aim,
  onClose,
}: {
  visible: boolean;
  photoUri: string;
  /** The model's guesses for this photo (bug ids), shown first before typing. */
  top3?: string[];
  /** The model's scores for `top3`, and where the scan looked: sent with a shared photo. */
  top3p?: number[];
  aim?: Aim;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const addCatch = useAddCatch();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Bug | null>(null);
  const [share, setShare] = useState(true);
  const canShare = useCanShareTraining();

  const nameOf = (b: Bug) => bugName(lang, b.id);
  const results = useMemo(() => searchSpecies(allBugs(), query, nameOf).slice(0, MAX_RESULTS), [query, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggested = useMemo(() => top3.map((id) => findBug(id)).filter((b): b is Bug => !!b), [top3]);

  const close = () => {
    setQuery('');
    setPicked(null);
    onClose();
  };
  const confirm = () => {
    if (!picked) return;
    // Already in the Dex: no second catch (catchBug ignores it), but the label can still be shared.
    if (useAppStore.getState().dex.has(picked.id)) {
      if (canShare && share) {
        void shareForTraining({ bugId: picked.id, latin: picked.latin, kind: 'manual', photoUri, top3, ...(top3p ? { top3p } : {}), ...(aim ? { aim } : {}) });
      }
      useAppStore.getState().showToast({ text: t('nameIt.already', { name: nameOf(picked) }), icon: picked.emoji, bg: PB.yellow });
      close();
      return;
    }
    addCatch(picked, photoUri, {
      source: 'manual',
      name: nameOf(picked),
      ...(canShare && share ? { share: { kind: 'manual' as const, top3, ...(top3p ? { top3p } : {}), ...(aim ? { aim } : {}) } } : {}),
    });
    close();
  };

  const row = (b: Bug) => (
    <Pressable key={b.id} onPress={() => setPicked(b)} style={styles.row} accessibilityRole="button" accessibilityLabel={nameOf(b)}>
      <BugIcon bug={b} size={36} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowName} numberOfLines={1}>{nameOf(b)}</Text>
        <Text style={styles.rowLatin} numberOfLines={1}>{b.latin}</Text>
      </View>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={styles.root}>
        <View style={styles.head}>
          <Text style={styles.title}>{picked ? t('nameIt.confirmTitle') : t('nameIt.title')}</Text>
          <Pressable onPress={picked ? () => setPicked(null) : close} hitSlop={10} accessibilityRole="button" accessibilityLabel={picked ? t('nameIt.back') : t('common.close')}>
            <Text style={styles.close}>{picked ? '←' : '✕'}</Text>
          </Pressable>
        </View>

        {picked ? (
          <View style={{ padding: 16, gap: 12 }}>
            <View style={styles.compare}>
              <View style={styles.photoBox}>
                <CatchPhoto uri={photoUri} fallback={<View />} />
              </View>
              <View style={styles.iconBox}>
                <BugIcon bug={picked} size={110} />
              </View>
            </View>
            <Text style={styles.pickName}>{nameOf(picked)}</Text>
            <Text style={styles.pickLatin}>{picked.latin}</Text>
            <Text style={styles.note}>{t('nameIt.namedNote')}</Text>
            <ShareTick value={share} onChange={setShare} />
            <Btn full bg={PB.green} color={PB.cream} onPress={confirm}>{t('result.addToDex')}</Btn>
            <Btn full bg={PB.cream} onPress={() => setPicked(null)}>{t('nameIt.back')}</Btn>
          </View>
        ) : (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('nameIt.placeholder')}
              placeholderTextColor="#8a8070"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              style={styles.input}
              accessibilityLabel={t('nameIt.placeholder')}
            />
            {query.trim() === '' ? (
              <View style={{ paddingHorizontal: 16 }}>
                {suggested.length > 0 && <Text style={styles.section}>{t('nameIt.modelThought')}</Text>}
                {suggested.map(row)}
                <Text style={styles.note}>{t('nameIt.hint')}</Text>
              </View>
            ) : results.length === 0 ? (
              <Text style={[styles.note, { paddingHorizontal: 16 }]}>{t('nameIt.noMatch')}</Text>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(b) => b.id}
                renderItem={({ item }) => row(item)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
              />
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PB.cream },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: PB.ink },
  close: { fontSize: 22, fontWeight: '800', color: PB.ink },
  input: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: PB.ink,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: PB.ink,
    backgroundColor: '#fff',
  },
  section: { marginTop: 8, marginBottom: 4, fontSize: 12, fontWeight: '800', color: PB.ink, opacity: 0.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0001' },
  rowName: { fontSize: 15, fontWeight: '700', color: PB.ink },
  rowLatin: { fontSize: 12, fontStyle: 'italic', color: PB.ink, opacity: 0.7 },
  note: { marginTop: 10, fontSize: 13, color: PB.ink, opacity: 0.8 },
  compare: { flexDirection: 'row', gap: 10 },
  photoBox: { flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: PB.ink, backgroundColor: '#ddd' },
  iconBox: { flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderColor: PB.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: PB.cream2 },
  pickName: { fontSize: 22, fontWeight: '800', color: PB.ink },
  pickLatin: { fontSize: 14, fontStyle: 'italic', color: PB.ink, opacity: 0.75, marginTop: -8 },
});

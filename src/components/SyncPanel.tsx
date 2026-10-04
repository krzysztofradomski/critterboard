import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { pendingCatches, syncCatches } from '@/backend/sync';
import { useOnlineActions } from '@/backend/useOnlineActions';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

/** What the online side holds and how the upload is going; also the way to delete it all. */
export function SyncPanel() {
  const t = useT();
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const online = useAppStore((s) => s.online);
  const status = useAppStore((s) => s.syncStatus);
  const catchLog = useAppStore((s) => s.catchLog);
  const setOnline = useAppStore((s) => s.setOnline);
  const { confirmDelete } = useOnlineActions();

  const { older } = useMemo(() => pendingCatches(useAppStore.getState()), [online, catchLog]);
  if (!networkOn && !online.hasData) return null;

  const pct = status.total > 0 ? Math.round((100 * status.done) / status.total) : 0;
  const failed = status.total - status.done;

  return (
    <View style={styles.wrap}>
      {networkOn && (
        <>
          {status.phase === 'syncing' ? (
            <>
              <Text style={styles.line}>{t('settings.sync.uploading', { done: status.done, total: status.total })}</Text>
              <View style={styles.bar}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
            </>
          ) : status.phase === 'error' ? (
            <View style={styles.row}>
              <Text style={[styles.line, { flex: 1 }]}>{t('settings.sync.failed', { n: failed })}</Text>
              <Pressable onPress={() => void syncCatches()} style={styles.btn}>
                <Text style={styles.btnText}>{t('settings.sync.retry')}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.line}>
              {online.uploaded.length > 0
                ? t('settings.sync.upToDate', { n: online.uploaded.length })
                : t('settings.sync.nothingYet')}
            </Text>
          )}
          {older.length > 0 && status.phase !== 'syncing' && (
            <View style={styles.row}>
              <Text style={[styles.line, { flex: 1 }]}>{t('settings.sync.older', { n: older.length })}</Text>
              <Pressable
                onPress={() => {
                  setOnline({ backfill: true });
                  void syncCatches();
                }}
                style={styles.btn}
              >
                <Text style={styles.btnText}>{t('settings.sync.upload')}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {online.hasData && (
        <Pressable onPress={confirmDelete} style={styles.delete} accessibilityRole="button">
          <Text style={styles.deleteText}>{t('settings.sync.delete')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { fontSize: 12, fontWeight: '700', color: PB.ink, opacity: 0.8 },
  bar: { height: 10, borderRadius: 99, borderWidth: 2, borderColor: PB.ink, backgroundColor: PB.cream2, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: PB.green },
  btn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  btnText: { fontSize: 11, fontWeight: '800', color: PB.ink },
  delete: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: PB.cream,
    borderColor: PB.red,
    borderWidth: 2.5,
    borderRadius: 12,
  },
  deleteText: { fontSize: 13, fontWeight: '800', color: PB.red },
});

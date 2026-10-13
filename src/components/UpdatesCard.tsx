import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Btn } from '@/components/Btn';
import { Sticker } from '@/components/Sticker';
import { fetchPackManifest } from '@/data/regionPacks';
import { useT } from '@/i18n/helpers';
import { pendingUpdates, type Update } from '@/lib/updates';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

/**
 * Brains → "Check for updates": installed region packs against packs/manifest.json. Checks quietly once on open when Network is on.
 */
export function UpdatesCard() {
  const t = useT();
  const { go } = useNav();
  const networkOn = useAppStore((s) => s.profile.networkOn);
  const installedRegions = useAppStore((s) => s.installedRegions);
  const installedPackVersions = useAppStore((s) => s.installedPackVersions);
  const [updates, setUpdates] = useState<Update[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);

  const check = async () => {
    if (!networkOn || checking) return;
    setChecking(true);
    const manifest = await fetchPackManifest();
    setFailed(!manifest);
    setUpdates(
      manifest
        ? pendingUpdates(manifest, {
            packs: Object.fromEntries(installedRegions.map((id) => [id, installedPackVersions[id] ?? 0])),
          })
        : null,
    );
    setChecking(false);
  };

  useEffect(() => {
    if (networkOn) void check();
  }, [networkOn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sticker bg={PB.cream2} style={{ padding: 14 }}>
      <Text style={styles.title}>{t('settings.updatesTitle')}</Text>
      {!networkOn ? (
        <Text style={styles.note}>{t('settings.updatesOffline')}</Text>
      ) : failed ? (
        <Text style={styles.note}>{t('settings.updatesCheckFailed')}</Text>
      ) : updates && updates.length === 0 ? (
        <Text style={styles.note}>{t('settings.updatesNone')}</Text>
      ) : null}
      {(updates ?? []).map((u) => (
        <View key={`pack-${u.id}`} style={styles.row}>
          <Text style={styles.rowText}>
            {t('settings.updatesPack', { name: t(`regions.list.${u.id}.name`), version: u.version })}
          </Text>
          <Btn bg={PB.green} color={PB.cream} onPress={() => go('region', { id: u.id })}>
            {t('settings.updatesOpen')}
          </Btn>
        </View>
      ))}
      {networkOn && (
        <Btn full bg={PB.cream} onPress={() => void check()} style={{ marginTop: 10 }}>
          {checking ? t('settings.updatesChecking') : t('settings.updatesCheck')}
        </Btn>
      )}
    </Sticker>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '800', color: PB.ink },
  note: { marginTop: 6, fontSize: 13, color: PB.ink },
  row: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { flex: 1, fontSize: 13, color: PB.ink, fontWeight: '600' },
});

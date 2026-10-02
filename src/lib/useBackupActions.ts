import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { resetBackendSession } from '@/backend/cloudflare';
import { useT } from '@/i18n/helpers';
import { backupFilename, buildBackup, parseBackup, planRestore } from '@/lib/backup';
import { shareBlob } from '@/lib/export';
import { PB } from '@/tokens/pb';
import { EMPTY_ONLINE, useAppStore } from '@/store/useAppStore';

/** Export a backup file / restore one. Everything is a file the user chooses where to keep. */
export function useBackupActions() {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);

  const doExport = useCallback(
    async (includeIdentity: boolean) => {
      const s = useAppStore.getState();
      const backup = buildBackup(s, { includeIdentity });
      const outcome = await shareBlob({
        filename: backupFilename(),
        mimeType: 'application/json',
        body: JSON.stringify(backup),
      });
      showToast(
        outcome.ok
          ? { text: t('help.data.exportToast', { filename: outcome.filename }), icon: '💾', bg: PB.green }
          : { text: t('help.data.exportUnavailable'), icon: '⚠️', bg: PB.red },
      );
    },
    [showToast, t],
  );

  const exportBackup = useCallback(() => {
    // The online key is a secret: only offer it when there is something online to get back.
    if (!useAppStore.getState().online.hasData) {
      void doExport(false);
      return;
    }
    Alert.alert(t('help.backup.keyTitle'), t('help.backup.keyBody'), [
      { text: t('settings.sync.cancel'), style: 'cancel' },
      { text: t('help.backup.keyWithout'), onPress: () => void doExport(false) },
      { text: t('help.backup.keyWith'), onPress: () => void doExport(true) },
    ]);
  }, [doExport, t]);

  const importBackup = useCallback(async () => {
    let text: string;
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      if ((asset.size ?? 0) > 20_000_000) throw new Error('too large');
      text = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
    } catch {
      showToast({ text: t('help.backup.readFailed'), icon: '⚠️', bg: PB.red });
      return;
    }
    const backup = parseBackup(text);
    if (!backup) {
      showToast({ text: t('help.backup.invalid'), icon: '⚠️', bg: PB.red });
      return;
    }
    const { patch, summary } = planRestore(useAppStore.getState(), backup);
    const date = backup.exportedAt ? backup.exportedAt.slice(0, 10) : '';
    Alert.alert(
      t('help.backup.restoreTitle'),
      t('help.backup.restoreBody', { species: summary.species, catches: summary.catches, date }),
      [
        { text: t('settings.sync.cancel'), style: 'cancel' },
        {
          text: t('help.backup.restoreYes'),
          onPress: () => {
            const { settings, ...rest } = patch as { settings: { name: string; minConfidence: number; hapticsOn: boolean } } & Record<string, unknown>;
            useAppStore.setState((s) => ({
              ...rest,
              profile: {
                ...s.profile,
                ...settings,
                // A restored identity is not trusted with sharing: everything online starts off.
                ...(summary.adoptedIdentity
                  ? { networkOn: false, leaderboardOn: false, locationShareOn: false, crashReportingOn: false }
                  : {}),
              },
              ...(summary.adoptedIdentity ? { online: EMPTY_ONLINE } : {}),
            }));
            if (summary.adoptedIdentity) resetBackendSession();
            showToast({ text: t('help.backup.restored', { n: summary.catches }), icon: '💾', bg: PB.green });
            if (summary.needsRegion) {
              setTimeout(() => showToast({ text: t('help.backup.regionHint'), icon: '📦', bg: PB.yellow }), 2600);
            } else if (summary.adoptedIdentity) {
              setTimeout(() => showToast({ text: t('help.backup.identityHint'), icon: '🔑', bg: PB.yellow }), 2600);
            }
          },
        },
      ],
    );
  }, [showToast, t]);

  return { exportBackup, importBackup };
}

import { useCallback } from 'react';
import { Alert } from 'react-native';

import { clearOnlineLocations, deleteOnlineData, hideOnlineProfile, pendingCatches, syncCatches } from '@/backend/sync';
import { useT } from '@/i18n/helpers';
import { PB } from '@/tokens/pb';
import { useAppStore } from '@/store/useAppStore';

/**
 * The privacy switches that touch the server. Flipping them is never just a local flag:
 * switching Network off asks what to do with what is already online, switching location
 * sharing off removes stored coordinates, and switching Network on offers to upload earlier catches.
 */
export function useOnlineActions() {
  const t = useT();
  const showToast = useAppStore((s) => s.showToast);

  const deleteAll = useCallback(async (): Promise<boolean> => {
    const ok = await deleteOnlineData();
    showToast(
      ok
        ? { text: t('settings.sync.deleted'), icon: '🗑️', bg: PB.green }
        : { text: t('settings.sync.deleteFailed'), icon: '⚠️', bg: PB.red },
    );
    return ok;
  }, [showToast, t]);

  /** Ask, then delete. */
  const confirmDelete = useCallback(() => {
    Alert.alert(t('settings.sync.deleteConfirmTitle'), t('settings.sync.deleteConfirmBody'), [
      { text: t('settings.sync.cancel'), style: 'cancel' },
      { text: t('settings.sync.delete'), style: 'destructive', onPress: () => void deleteAll() },
    ]);
  }, [deleteAll, t]);

  const turnOff = useCallback(() => {
    useAppStore.getState().setProfile({
      networkOn: false,
      leaderboardOn: false,
      locationShareOn: false,
      crashReportingOn: false,
    });
  }, []);

  const setNetwork = useCallback(
    (on: boolean) => {
      const store = useAppStore.getState();
      if (on) {
        store.setProfile({ networkOn: true });
        if (store.online.since === null) store.setOnline({ since: Date.now() });
        const { older } = pendingCatches(useAppStore.getState());
        if (older.length > 0) {
          Alert.alert(
            t('settings.sync.olderPromptTitle', { n: older.length }),
            t('settings.sync.olderPromptBody'),
            [
              { text: t('settings.sync.notNow'), style: 'cancel' },
              {
                text: t('settings.sync.upload'),
                onPress: () => {
                  useAppStore.getState().setOnline({ backfill: true });
                  void syncCatches();
                },
              },
            ],
          );
        }
        void syncCatches();
        return;
      }
      if (!store.online.hasData) {
        turnOff();
        return;
      }
      // Something is already online: switching off must not silently leave it there.
      Alert.alert(t('settings.sync.offTitle'), t('settings.sync.offBody'), [
        { text: t('settings.sync.cancel'), style: 'cancel' },
        {
          text: t('settings.sync.offKeep'),
          onPress: () =>
            void hideOnlineProfile().then((ok) => {
              if (!ok) showToast({ text: t('settings.sync.hideFailed'), icon: '⚠️', bg: PB.red });
              turnOff();
            }),
        },
        {
          text: t('settings.sync.offDelete'),
          style: 'destructive',
          onPress: () => void deleteAll().then((ok) => ok && turnOff()),
        },
      ]);
    },
    [deleteAll, showToast, t, turnOff],
  );

  const setLocationShare = useCallback(
    (on: boolean) => {
      useAppStore.getState().setProfile({ locationShareOn: on });
      if (!on && useAppStore.getState().online.hasData) {
        void clearOnlineLocations().then((ok) =>
          showToast(
            ok
              ? { text: t('settings.sync.locationsCleared'), icon: '📍', bg: PB.green }
              : { text: t('settings.sync.locationsClearFailed'), icon: '⚠️', bg: PB.red },
          ),
        );
      }
    },
    [showToast, t],
  );

  return { setNetwork, setLocationShare, confirmDelete };
}

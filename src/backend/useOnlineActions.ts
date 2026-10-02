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

  /** A yes/no dialog whose confirm button names what will happen. */
  const confirm = useCallback(
    (title: string, body: string, yes: string, onYes: () => void, destructive = false) =>
      Alert.alert(title, body, [
        { text: t('settings.sync.cancel'), style: 'cancel' },
        { text: yes, style: destructive ? 'destructive' : 'default', onPress: onYes },
      ]),
    [t],
  );

  const enableNetwork = useCallback(() => {
    const store = useAppStore.getState();
    store.setProfile({ networkOn: true });
    if (store.online.since === null) store.setOnline({ since: Date.now() });
    const { older } = pendingCatches(useAppStore.getState());
    if (older.length > 0) {
      Alert.alert(t('settings.sync.olderPromptTitle', { n: older.length }), t('settings.sync.olderPromptBody'), [
        { text: t('settings.sync.notNow'), style: 'cancel' },
        {
          text: t('settings.sync.upload'),
          onPress: () => {
            useAppStore.getState().setOnline({ backfill: true });
            void syncCatches();
          },
        },
      ]);
    }
    void syncCatches();
  }, [t]);

  const setNetwork = useCallback(
    (on: boolean) => {
      const store = useAppStore.getState();
      if (on) {
        // The first time (or the first time after deleting everything) say what going online means.
        if (store.online.since === null) {
          confirm(t('settings.confirm.networkTitle'), t('settings.confirm.networkBody'), t('settings.confirm.networkYes'), enableNetwork);
        } else {
          enableNetwork();
        }
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
    [confirm, deleteAll, enableNetwork, showToast, t, turnOff],
  );

  const setLeaderboard = useCallback(
    (on: boolean) => {
      const apply = () => useAppStore.getState().setProfile({ leaderboardOn: on });
      if (on) confirm(t('settings.confirm.boardTitle'), t('settings.confirm.boardBody'), t('settings.confirm.boardYes'), apply);
      else apply();
    },
    [confirm, t],
  );

  const setLocationShare = useCallback(
    (on: boolean) => {
      if (on) {
        confirm(t('settings.confirm.locTitle'), t('settings.confirm.locBody'), t('settings.confirm.locYes'), () =>
          useAppStore.getState().setProfile({ locationShareOn: true }),
        );
        return;
      }
      const off = () => {
        useAppStore.getState().setProfile({ locationShareOn: false });
        if (useAppStore.getState().online.hasData) {
          void clearOnlineLocations().then((ok) =>
            showToast(
              ok
                ? { text: t('settings.sync.locationsCleared'), icon: '📍', bg: PB.green }
                : { text: t('settings.sync.locationsClearFailed'), icon: '⚠️', bg: PB.red },
            ),
          );
        }
      };
      // Switching off deletes what is stored online, so ask first (nothing to ask about if nothing is online).
      if (useAppStore.getState().online.hasData) {
        confirm(t('settings.confirm.locOffTitle'), t('settings.confirm.locOffBody'), t('settings.confirm.locOffYes'), off, true);
      } else {
        off();
      }
    },
    [confirm, showToast, t],
  );

  return { setNetwork, setLeaderboard, setLocationShare, confirmDelete };
}

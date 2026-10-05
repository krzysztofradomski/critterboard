import React, { useEffect, useRef, useState } from "react";
import * as FileSystem from 'expo-file-system/legacy';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { CreditsDialog } from "@/components/CreditsDialog";
import { PersonaPick } from "@/components/PersonaPick";
import { SettingToggle } from "@/components/SettingToggle";
import { SyncPanel } from "@/components/SyncPanel";
import { useOnlineActions } from "@/backend/useOnlineActions";
import { Sticker } from "@/components/Sticker";
import { ensurePackIcons } from "@/data/bugIcons";
import { AVAILABLE_REGION_IDS, REGIONS, type Region, type RegionStatus } from "@/data/regions";
import { VISION_MODEL } from "@/data/visionModel";
import { downloadMapPack, resolveMapUrl } from "@/map/mapPack";
import {
  cachePackData, downloadPackModel, PACK_MANIFEST_URL,
  type PackManifest, type RegionPack,
} from "@/data/regionPacks";
import { Btn } from "@/components/Btn";
import { CHAT_MODEL, deleteChatModel, downloadChatModel, ejectChatModel, initChatModel, loadChatModel, type ChatModelStatus } from "@/ai";
import { useChatModel } from "@/lib/useChatModel";
import { LANG_META, type LangId } from "@/i18n";
import { useT } from "@/i18n/helpers";
import { PERSONA_IDS } from "@/personas";
import { usePersona } from "@/personas/hooks";
import { PB } from "@/tokens/pb";
import { isOffensiveName } from "@/lib/moderation";
import { useAppStore } from "@/store/useAppStore";
import { useNav } from "@/store/useNav";
import { haptics } from '@/lib/haptics';

const NAME_MAX = 18;

function localLlmDesc(
  status: ChatModelStatus,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const vars = { model: CHAT_MODEL.name, size: CHAT_MODEL.sizeGb };
  if (status === 'unsupported') return t('settings.localLlmNoWeb', vars);
  if (status === 'tooLittleRam') return t('settings.localLlmTooLittleRam', vars);
  if (status === 'error') return t('settings.localLlmError', vars);
  if (status === 'ejected') return t('settings.localLlmEjected', vars);
  if (status === 'absent' || status === 'checking') return t('settings.localLlmOff', vars);
  return t('settings.localLlmOn', vars);
}

export function Settings() {
  const { go } = useNav();
  const persona = useAppStore((s) => s.persona);
  const profile = useAppStore((s) => s.profile);
  const online = useOnlineActions();
  const language = useAppStore((s) => s.language);
  const setProfile = useAppStore((s) => s.setProfile);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const clearConversationData = useAppStore((s) => s.clearConversationData);
  const conversationThreadCount = useAppStore(
    (s) => Object.keys(s.chatThreads).length,
  );
  const conversationMemoryCount = useAppStore(
    (s) => s.conversationMemory.length,
  );
  const showToast = useAppStore((s) => s.showToast);
  const installedRegions = useAppStore((s) => s.installedRegions);
  const activeRegion = useAppStore((s) => s.activeRegion);
  const setActiveRegion = useAppStore((s) => s.setActiveRegion);
  const installRegion = useAppStore((s) => s.installRegion);
  const P = usePersona(persona);
  const t = useT();

  const chatModel = useChatModel();
  const modelState = chatModel.status;
  const downloadPct = chatModel.pct;
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [confirmMemoryWipe, setConfirmMemoryWipe] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [nameError, setNameError] = useState(false);
  const [regions, setRegions] = useState<Record<string, RegionStatus>>(() =>
    Object.fromEntries(
      REGIONS.map((r) => [r.id, installedRegions.includes(r.id) ? 'installed' : 'available']),
    ),
  );
  const packDownloadHandles = useRef<Record<string, FileSystem.DownloadResumable | null>>({});

  // A pack removed on the region screen (this screen stays mounted underneath).
  useEffect(() => {
    setRegions((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, st]) => [
          id,
          typeof st === 'object' ? st : installedRegions.includes(id) ? 'installed' : 'available',
        ]),
      ),
    );
  }, [installedRegions]);

  useEffect(() => {
    setNameDraft(profile.name);
  }, [profile.name]);

  // Pick up a chat model already on disk (loads it) or mark it absent.
  useEffect(() => {
    void initChatModel();
  }, []);

  useEffect(
    () => () => {
      Object.values(packDownloadHandles.current).forEach(
        (h) => h?.pauseAsync().catch(() => {}),
      );
    },
    [],
  );

  const installedCount = Object.values(regions).filter(
    (s) => s === "installed",
  ).length;
  const totalInstalledMb = REGIONS.reduce(
    (acc, r) => (regions[r.id] === "installed" ? acc + r.size : acc),
    0,
  );

  const commitName = () => {
    const v = nameDraft.trim().slice(0, 18) || t("common.you");
    if (isOffensiveName(v)) {
      setNameError(true);
      return;
    }
    setNameError(false);
    if (v !== profile.name) setProfile({ name: v });
  };

  const startDownload = async (region: Region) => {
    const status = regions[region.id];
    if (typeof status === "object") return; // already in progress

    if (status === "installed") return; // removed from the region screen

    setRegions((r) => ({ ...r, [region.id]: { downloading: 0 } }));

    try {
      // Step 1: Fetch the pack manifest to resolve the pack JSON URL.
      const manifestRes = await fetch(PACK_MANIFEST_URL);
      if (!manifestRes.ok) throw new Error(`manifest ${manifestRes.status}`);
      const manifest = (await manifestRes.json()) as PackManifest;
      const packEntry = manifest.packs[region.id];
      if (!packEntry?.url) throw new Error(`no pack entry for ${region.id}`);

      // Step 2: Fetch the pack JSON (bugs + labelMap + modelUrl).
      const packRes = await fetch(packEntry.url);
      if (!packRes.ok) throw new Error(`pack fetch ${packRes.status}`);
      const pack = (await packRes.json()) as RegionPack;

      // Cache the pack data in AsyncStorage and merge bugs into the registry.
      await cachePackData(pack);

      // Step 3: Download the .pte model file to the filesystem (checked, swapped in whole).
      if (!FileSystem.documentDirectory) throw new Error('no documentDirectory');

      // One progress bar for the whole install: the model's share is its
      // slice of the total download, the map takes the rest.
      const mapUrl = region.mapSize > 0 ? resolveMapUrl(pack) : null;
      const modelShare = mapUrl ? (region.size - region.mapSize) / region.size : 1;
      await downloadPackModel(
        FileSystem.documentDirectory,
        pack,
        (pct) => setRegions((prev) => ({ ...prev, [region.id]: { downloading: Math.floor(pct * modelShare) } })),
        (dl) => (packDownloadHandles.current[region.id] = dl),
      );
      packDownloadHandles.current[region.id] = null;

      // Species icons: one small atlas, split on the device. Best-effort,
      // species without an icon show their emoji.
      await ensurePackIcons(FileSystem.documentDirectory, pack);

      // The region's offline map. Not fatal: the region still works for
      // scanning, and the Map tab offers the download again.
      if (mapUrl) {
        try {
          await downloadMapPack(region.id, pack, (pct) =>
            setRegions((prev) => ({
              ...prev,
              [region.id]: { downloading: Math.floor(modelShare * 100 + pct * (1 - modelShare)) },
            })),
          );
        } catch {
          showToast({ text: t("settings.mapDownloadFailed"), icon: "🗺️", bg: PB.cream2 });
        }
      }

      // Step 4: Persist installed state (version drives boot-time refresh).
      installRegion(region.id, pack.labelMap, pack.version);
      setRegions((r) => ({ ...r, [region.id]: "installed" }));
    } catch {
      setRegions((r) => ({ ...r, [region.id]: "available" }));
      showToast({
        text: t('settings.packDownloadFailed', { name: t(`regions.list.${region.id}.name`) }),
        bg: '#e53935',
      });
    }
  };

  // The persona name can be multi-word ("Prof. Larva") — strip honorifics
  // so the "Language for X's sass" copy reads naturally in every locale.
  const personaShort = P.name.split(" ").pop() ?? P.name;

  const wipeConversationMemory = () => {
    if (!confirmMemoryWipe) {
      setConfirmMemoryWipe(true);
      return;
    }
    setConfirmMemoryWipe(false);
    clearConversationData();
    showToast({
      text: t("settings.memoryClearToast"),
      icon: "🧹",
      bg: PB.blue,
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("settings.title")}</Text>
        <Text style={styles.sub}>{t("settings.sub")}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <View style={[styles.avatarBig, { backgroundColor: P.avatarBg }]}>
              <Text style={{ fontSize: 22 }}>{P.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t("settings.guideTitle")}</Text>
              <Text style={styles.cardSub}>{P.title}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {PERSONA_IDS.map((pid) => (
              <PersonaPick key={pid} pid={pid} compact />
            ))}
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View
            style={[
              styles.bandHeader,
              { backgroundColor: profile.networkOn ? PB.orange : PB.green },
            ]}
          >
            <Text style={{ fontSize: 26 }}>👤</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>{t("settings.profileBand")}</Text>
              <Text style={styles.bandSub}>
                {profile.networkOn
                  ? t("settings.profileLeaks")
                  : t("settings.profileSafe")}
              </Text>
            </View>
          </View>
          <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
            <View style={styles.nameHeader}>
              <Text style={styles.sectionLabel}>
                {t("settings.displayName")}
              </Text>
              <Text
                style={[
                  styles.nameCounter,
                  nameDraft.length >= NAME_MAX && styles.nameCounterFull,
                ]}
              >
                {nameDraft.length}/{NAME_MAX}
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <View style={styles.nameAvatar}>
                <Text style={styles.nameAvatarText}>
                  {(profile.name[0] ?? "?").toUpperCase()}
                </Text>
              </View>
              <TextInput
                value={nameDraft}
                onChangeText={(v) => { setNameDraft(v); setNameError(false); }}
                onBlur={commitName}
                onSubmitEditing={commitName}
                placeholder={t("settings.namePlaceholder")}
                placeholderTextColor={PB.ink + "99"}
                maxLength={NAME_MAX}
                style={styles.nameInput}
              />
            </View>
            <Text style={styles.nameHint}>{t("settings.nameHint")}</Text>
            {nameError && (
              <Text style={styles.nameError}>{t("settings.nameOffensive")}</Text>
            )}

            <Text style={[styles.sectionLabel, { marginTop: 10 }]}>
              {t("settings.privacy")}
            </Text>
            <View style={{ gap: 8 }}>
              <SettingToggle
                icon="📡"
                color={PB.orange}
                label={t("settings.networkLabel")}
                desc={
                  profile.networkOn
                    ? t("settings.networkOn")
                    : t("settings.networkOff")
                }
                value={profile.networkOn}
                onChange={online.setNetwork}
              />
              <SettingToggle
                icon="🏆"
                color={PB.purple}
                label={t("settings.boardLabel")}
                desc={
                  profile.networkOn
                    ? t("settings.boardOn")
                    : t("settings.boardNeeds")
                }
                value={profile.leaderboardOn && profile.networkOn}
                onChange={online.setLeaderboard}
                disabled={!profile.networkOn}
              />
              <SettingToggle
                icon="📍"
                color={PB.blue}
                label={t("settings.locShareLabel")}
                desc={
                  profile.locationShareOn && profile.networkOn
                    ? t("settings.locShareOn")
                    : t("settings.locShareOff")
                }
                value={profile.locationShareOn && profile.networkOn}
                onChange={online.setLocationShare}
                disabled={!profile.networkOn}
              />
              <SettingToggle
                icon="🦋"
                color={PB.green}
                label={t("settings.sightingsLabel")}
                desc={
                  !profile.networkOn
                    ? t("settings.boardNeeds")
                    : profile.sightingsOn
                      ? t("settings.sightingsOn")
                      : t("settings.sightingsOff")
                }
                value={profile.sightingsOn && profile.networkOn}
                onChange={online.setSightings}
                disabled={!profile.networkOn}
              />
              <SettingToggle
                icon="🛟"
                color={PB.red}
                label={t("settings.crashLabel")}
                desc={
                  !profile.networkOn
                    ? t("settings.crashNeeds")
                    : profile.crashReportingOn
                      ? t("settings.crashOn")
                      : t("settings.crashOff")
                }
                value={profile.crashReportingOn && profile.networkOn}
                onChange={online.setCrashReporting}
                disabled={!profile.networkOn}
              />
              <SyncPanel />
            </View>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 14 }}>
          <ModelTile
            icon="🧠"
            color={PB.pink}
            title={t("settings.model.larva", { model: CHAT_MODEL.name })}
            meta={t("settings.model.larvaMeta", {
              size: CHAT_MODEL.sizeGb,
              state:
                modelState === 'downloading'
                  ? t("settings.model.larvaDownloading", {
                      done: ((CHAT_MODEL.sizeGb * downloadPct) / 100).toFixed(1),
                    })
                  : modelState === 'ready' || modelState === 'loading'
                    ? t("settings.model.larvaInstalled")
                    : modelState === 'unsupported'
                      ? t("settings.model.larvaPhoneOnly")
                      : modelState === 'tooLittleRam'
                        ? t("settings.model.larvaTooLittleRam")
                        : t("settings.model.larvaIdle"),
            })}
            statusText={
              modelState === 'ready'
                ? t("settings.model.ready")
                : modelState === 'downloading'
                  ? t("settings.model.downloading", { pct: downloadPct })
                  : modelState === 'loading'
                    ? t("settings.model.loading")
                    : modelState === 'error'
                      ? t("settings.model.error")
                      : modelState === 'unsupported'
                        ? t("settings.model.phoneOnly")
                        : modelState === 'tooLittleRam'
                          ? t("settings.model.notSupported")
                          : t("settings.model.get")
            }
            statusBg={
              modelState === 'ready' ? PB.green
                : modelState === 'error' ? PB.red
                : modelState === 'downloading' || modelState === 'loading' ? PB.yellow
                : PB.cream2
            }
            statusFg={
              modelState === 'ready' || modelState === 'error' ? PB.cream : PB.ink
            }
            progressPct={
              modelState === 'downloading' ? downloadPct
                : modelState === 'loading' || modelState === 'ready' ? 100
                : undefined
            }
            progressColor={PB.pink}
          />
          <View style={{ height: 12 }} />
          <SettingToggle
            icon="📱"
            color={PB.pink}
            label={t("settings.localLlmLabel", { model: CHAT_MODEL.name })}
            desc={localLlmDesc(modelState, t)}
            value={
              modelState === 'downloading' || modelState === 'loading' || modelState === 'ready' || modelState === 'ejected'
            }
            onChange={(v) => {
              if (v) {
                if (chatModel.fit !== 'confirm') {
                  void downloadChatModel();
                  return;
                }
                // 4 GB phones: the model fits, but only just. Ask first.
                Alert.alert(
                  t("settings.localLlmLowRamTitle"),
                  t("settings.localLlmLowRamBody", { model: CHAT_MODEL.name, size: CHAT_MODEL.sizeGb }),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("settings.localLlmLowRamCta"), onPress: () => void downloadChatModel() },
                  ],
                );
                return;
              }
              // Turning chat off frees ~3 GB, but a re-download is slow: confirm.
              Alert.alert(
                t("settings.localLlmDeleteTitle"),
                t("settings.localLlmDeleteBody", { model: CHAT_MODEL.name, size: CHAT_MODEL.sizeGb }),
                [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("settings.localLlmDeleteCta"),
                    style: "destructive",
                    onPress: () => void deleteChatModel(),
                  },
                ],
              );
            }}
            disabled={
              modelState === "unsupported" || modelState === "tooLittleRam" || modelState === "checking"
            }
          />
          {modelState === 'ready' || modelState === 'ejected' ? (
            <Btn
              full
              bg={PB.cream}
              onPress={() => void (modelState === 'ready' ? ejectChatModel() : loadChatModel())}
              style={{ marginTop: 10 }}
            >
              {t(modelState === 'ready' ? "settings.localLlmEject" : "settings.localLlmLoad")}
            </Btn>
          ) : null}
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={[styles.bandHeader, { backgroundColor: PB.blue }]}>
            <Text style={{ fontSize: 26 }}>👁️</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>{VISION_MODEL.name}</Text>
              <Text style={styles.bandSub}>
                {t("settings.model.visionMeta", {
                  id: VISION_MODEL.id,
                  mb: VISION_MODEL.sizeMb,
                  n: VISION_MODEL.species.toLocaleString(),
                })}
              </Text>
            </View>
            <View style={styles.regionMetaPill}>
              <Text style={styles.regionMetaText}>
                {activeRegion ? t("settings.model.ready") : t("settings.model.noPack")}
              </Text>
            </View>
          </View>
          {!activeRegion && !Object.values(regions).some((r) => typeof r === "object") && (
            <View style={{ paddingHorizontal: 10, paddingTop: 10, gap: 8 }}>
              <Text style={styles.regionFoot}>{t("settings.packHint")}</Text>
              <Pressable
                onPress={() => startDownload(REGIONS.find((r) => r.id === "eu-ce")!)}
                style={styles.packCta}
              >
                <Text style={styles.packCtaText}>
                  {t("settings.packCta", {
                    name: t("regions.list.eu-ce.name"),
                    mb: REGIONS.find((r) => r.id === "eu-ce")!.size,
                  })}
                </Text>
              </Pressable>
            </View>
          )}
          <Text style={[styles.sectionLabel, { paddingHorizontal: 12, paddingTop: 10 }]}>
            {t("settings.regionsBand")}
          </Text>
          <View style={{ padding: 10, gap: 8 }}>
            {REGIONS.map((region) => {
              const status = regions[region.id];
              const available = AVAILABLE_REGION_IDS.has(region.id);
              const isInstalled = status === "installed";
              const isActive = isInstalled && activeRegion === region.id;
              const isDownloading = typeof status === "object";
              const downloadPct = isDownloading
                ? (status as { downloading: number }).downloading
                : 0;

              return (
                <Pressable
                  key={region.id}
                  disabled={!available}
                  onPress={() => {
                    if (isDownloading) return;
                    if (isActive) {
                      go("region", { id: region.id });
                    } else if (isInstalled) {
                      setActiveRegion(region.id);
                      showToast({
                        text: t("settings.regionSwitched", { name: t(`regions.list.${region.id}.name`) }),
                        icon: region.emoji,
                        bg: PB.green,
                      });
                    } else {
                      startDownload(region);
                    }
                  }}
                  style={[
                    styles.regionRow,
                    isActive && { borderWidth: 3, backgroundColor: region.color + "44" },
                    !available && { opacity: 0.45 },
                  ]}
                >
                  {isDownloading && (
                    <View
                      style={[
                        styles.regionDownloadFill,
                        {
                          width: `${downloadPct}%`,
                          backgroundColor: region.color + "66",
                        },
                      ]}
                      pointerEvents="none"
                    />
                  )}
                  <View
                    style={[
                      styles.regionFlag,
                      { backgroundColor: region.color },
                    ]}
                  >
                    <Text style={{ fontSize: 18 }}>{region.emoji}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.regionName}>
                      {t(`regions.list.${region.id}.name`)}
                    </Text>
                    <Text style={styles.regionSub}>
                      {isDownloading
                        ? t("settings.regionDownloading", {
                            pct: Math.floor(downloadPct),
                            mb: region.size,
                          })
                        : available
                          ? `${t(`regions.list.${region.id}.sub`)} · ${region.size} MB`
                          : t("settings.regionSoonSub")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.regionStatus,
                      {
                        backgroundColor: isActive
                          ? PB.green
                          : isDownloading
                            ? PB.yellow
                            : PB.cream,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.regionStatusText,
                        { color: isActive ? PB.cream : PB.ink },
                      ]}
                    >
                      {!available
                        ? t("settings.regionSoon")
                        : isActive
                          ? t("settings.regionActive")
                          : isInstalled
                            ? t("settings.regionUse")
                            : isDownloading
                          ? `${Math.floor(downloadPct)}%`
                          : t("settings.regionGet")}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.regionFoot}>{t("settings.regionFoot")}</Text>
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 10 }}>
          <SettingToggle
            icon="📳"
            color={PB.yellow}
            label={t("settings.haptics.label")}
            desc={profile.hapticsOn ? t("settings.haptics.on") : t("settings.haptics.off")}
            value={profile.hapticsOn}
            onChange={(v) => {
              setProfile({ hapticsOn: v });
              if (v) haptics.success(); // a taste of what you just switched on
            }}
          />
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={[styles.bandHeader, { backgroundColor: PB.orange }]}>
            <Text style={{ fontSize: 26 }}>🎯</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>{t("settings.minConf.title")}</Text>
              <Text style={styles.bandSub}>{t("settings.minConf.sub")}</Text>
            </View>
          </View>
          <View style={styles.langGrid}>
            {([20, 33, 50, 70] as const).map((pct) => {
              const active = profile.minConfidence === pct;
              return (
                <Pressable
                  key={pct}
                  onPress={() => {
                    haptics.select();
                    setProfile({ minConfidence: pct });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.langCell,
                    {
                      backgroundColor: active ? PB.green : PB.cream,
                      shadowOffset: active ? { width: 2, height: 2 } : { width: 1.5, height: 1.5 },
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.langNative, { color: active ? PB.cream : PB.ink }]}>
                      {pct}%
                    </Text>
                    <Text
                      style={[
                        styles.langLabel,
                        { color: active ? PB.cream : PB.ink, opacity: active ? 0.85 : 0.55 },
                      ]}
                    >
                      {t(`settings.minConf.l${pct}`)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.regionFoot, { paddingHorizontal: 14, paddingBottom: 12 }]}>
            {t("settings.minConf.foot")}
          </Text>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={[styles.bandHeader, { backgroundColor: PB.purple }]}>
            <Text style={{ fontSize: 26 }}>💬</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>{t("settings.languageBand")}</Text>
              <Text style={styles.bandSub}>
                {t("settings.languageSub", { name: personaShort })}
              </Text>
            </View>
          </View>
          <View style={styles.langGrid}>
            {LANG_META.map((L) => {
              const active = language === L.id;
              return (
                <Pressable
                  key={L.id}
                  onPress={() => {
                    haptics.select();
                    setLanguage(L.id as LangId);
                  }}
                  style={[
                    styles.langCell,
                    {
                      backgroundColor: active ? PB.green : PB.cream,
                      shadowOffset: active
                        ? { width: 2, height: 2 }
                        : { width: 1.5, height: 1.5 },
                    },
                  ]}
                >
                  <Text style={{ fontSize: 18 }}>{L.flag}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        styles.langNative,
                        { color: active ? PB.cream : PB.ink },
                      ]}
                    >
                      {L.native}
                    </Text>
                    <Text
                      style={[
                        styles.langLabel,
                        {
                          color: active ? PB.cream : PB.ink,
                          opacity: active ? 0.85 : 0.55,
                        },
                      ]}
                    >
                      {L.english}
                    </Text>
                  </View>
                  {active && (
                    <Text
                      style={{
                        color: PB.cream,
                        fontWeight: "800",
                        fontSize: 14,
                      }}
                    >
                      ✓
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Sticker>

        <Sticker bg={PB.paper} style={{ padding: 0 }}>
          <View style={[styles.bandHeader, { backgroundColor: PB.blue }]}>
            <Text style={{ fontSize: 26 }}>🧠</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.bandTitle}>{t("settings.memoryBand")}</Text>
              <Text style={styles.bandSub}>{t("settings.memorySub")}</Text>
            </View>
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            <View style={styles.memoryMetaRow}>
              <Text style={styles.memoryMetaText}>
                {t("settings.memoryThreadsMeta", {
                  n: conversationThreadCount,
                })}
              </Text>
              <Text style={styles.memoryMetaText}>
                {t("settings.memoryEntriesMeta", {
                  n: conversationMemoryCount,
                })}
              </Text>
            </View>
            <Pressable
              onPress={wipeConversationMemory}
              style={styles.memoryClearBtn}
            >
              <Text style={styles.memoryClearBtnText}>
                {confirmMemoryWipe
                  ? t("settings.memoryClearConfirmCta")
                  : t("settings.memoryClearCta")}
              </Text>
            </Pressable>
          </View>
        </Sticker>

        <View style={styles.quickRow}>
          <Sticker
            bg={PB.pink}
            style={styles.quickTile}
            onPress={() => go("openSourceLibraries")}
          >
            <Text style={{ fontSize: 26 }}>🐜</Text>
            <Text style={styles.quickTitle}>
              {t("settings.naturalistsTile")}
            </Text>
            <Text style={styles.quickSub}>{t("settings.naturalistsSub")}</Text>
          </Sticker>
          <Sticker
            bg={PB.blue}
            style={styles.quickTile}
            onPress={() => go("help")}
          >
            <Text style={{ fontSize: 26 }}>📖</Text>
            <Text style={styles.quickTitle}>{t("settings.helpTile")}</Text>
            <Text style={styles.quickSub}>{t("settings.helpSub")}</Text>
          </Sticker>
        </View>

        <Sticker
          bg={PB.yellow}
          rotate={-1}
          style={styles.creditsCard}
          onPress={() => setCreditsOpen(true)}
        >
          <Text style={styles.creditsTitle}>{t("settings.creditsTitle")}</Text>
          <Text style={styles.creditsSub}>{t("settings.creditsSub")}</Text>
          <Text style={styles.creditsCta}>{t("settings.viewCredits")}</Text>
        </Sticker>
      </ScrollView>

      <CreditsDialog
        visible={creditsOpen}
        onClose={() => setCreditsOpen(false)}
      />
    </View>
  );
}

function ModelTile({
  icon,
  color,
  title,
  meta,
  statusText,
  statusBg,
  statusFg,
  progressPct,
  progressColor,
}: {
  icon: string;
  color: string;
  title: string;
  meta: string;
  statusText: string;
  statusBg: string;
  statusFg: string;
  progressPct?: number;
  progressColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={[styles.modelIcon, { backgroundColor: color }]}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <Text style={styles.modelTitle}>{title}</Text>
          <View style={[styles.modelStatus, { backgroundColor: statusBg }]}>
            <Text style={[styles.modelStatusText, { color: statusFg }]}>
              {statusText}
            </Text>
          </View>
        </View>
        <Text style={styles.modelMeta}>{meta}</Text>
        {typeof progressPct === "number" && (
          <View style={styles.modelBar}>
            <View
              style={{
                width: `${progressPct}%`,
                height: "100%",
                backgroundColor: progressColor ?? PB.pink,
              }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: PB.cream,
    paddingTop: 50,
  },
  header: { paddingTop: 60, paddingHorizontal: 16, paddingBottom: 14 },
  title: { fontSize: 30, fontWeight: "800", color: PB.ink, lineHeight: 30 },
  sub: {
    fontSize: 13,
    color: PB.ink,
    opacity: 0.7,
    fontWeight: "600",
    marginTop: 4,
  },
  scroll: { paddingHorizontal: 14, paddingBottom: 130, gap: 12 },
  avatarBig: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: PB.ink },
  cardSub: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 2 },
  bandHeader: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    borderTopLeftRadius: 15.5,
    borderTopRightRadius: 15.5,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bandTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: PB.cream,
    lineHeight: 16,
  },
  bandSub: {
    fontSize: 12,
    color: PB.cream,
    opacity: 0.9,
    marginTop: 3,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: PB.ink,
    opacity: 0.65,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  nameAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderColor: PB.ink,
    borderWidth: 2.5,
    backgroundColor: PB.yellow,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  nameAvatarText: { fontSize: 16, fontWeight: "800", color: PB.ink },
  nameInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: "700",
    color: PB.ink,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  nameHint: { marginTop: 6, fontSize: 10, color: PB.ink, opacity: 0.55 },
  nameError: { marginTop: 4, fontSize: 11, fontWeight: "700", color: PB.red },
  nameHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 4,
  },
  nameCounter: {
    fontSize: 10,
    fontWeight: "700",
    color: PB.ink,
    opacity: 0.55,
  },
  nameCounterFull: { color: PB.red, opacity: 1 },
  modelIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  modelTitle: { fontSize: 16, fontWeight: "800", color: PB.ink },
  modelStatus: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  modelStatusText: { fontSize: 10, fontWeight: "800" },
  modelMeta: { fontSize: 11, color: PB.ink, opacity: 0.65, marginTop: 2 },
  modelBar: {
    marginTop: 10,
    height: 12,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    overflow: "hidden",
  },
  regionMetaPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  packCta: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: PB.yellow,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  packCtaText: { fontSize: 14, fontWeight: "800", color: PB.ink },
  regionMetaText: { fontSize: 10, fontWeight: "800", color: PB.ink },
  regionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
  },
  regionDownloadFill: { position: "absolute", top: 0, left: 0, bottom: 0 },
  regionFlag: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderColor: PB.ink,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  regionName: {
    fontSize: 13,
    fontWeight: "800",
    color: PB.ink,
    lineHeight: 14,
  },
  regionSub: { fontSize: 10, color: PB.ink, opacity: 0.65, marginTop: 2 },
  regionStatus: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    minWidth: 56,
    alignItems: "center",
  },
  regionStatusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },
  regionFoot: { fontSize: 10, color: PB.ink, opacity: 0.55, padding: 4 },
  memoryMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  memoryMetaText: {
    fontSize: 11,
    fontWeight: "700",
    color: PB.ink,
    opacity: 0.75,
  },
  memoryClearBtn: {
    marginTop: 2,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: PB.cream,
    alignItems: "center",
  },
  memoryClearBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: PB.ink,
    letterSpacing: 0.4,
  },
  langGrid: { padding: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  langCell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    width: "47%",
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 12,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  langNative: { fontSize: 13, fontWeight: "800", lineHeight: 14 },
  langLabel: { fontSize: 9, marginTop: 1 },
  quickRow: { flexDirection: "row", gap: 10 },
  quickTile: { flex: 1, padding: 14 },
  quickTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "800",
    color: PB.cream,
    lineHeight: 14,
  },
  quickSub: {
    marginTop: 3,
    fontSize: 11,
    color: PB.cream,
    opacity: 0.92,
    fontWeight: "600",
  },
  creditsCard: { padding: 14, alignItems: "center" },
  creditsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: PB.ink,
    textAlign: "center",
  },
  creditsSub: {
    fontSize: 12,
    color: PB.ink,
    opacity: 0.7,
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  creditsCta: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "800",
    color: PB.ink,
    opacity: 0.55,
    letterSpacing: 0.6,
  },
});

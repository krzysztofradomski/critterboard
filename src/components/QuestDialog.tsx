import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { PB } from "@/tokens/pb";
import { Btn } from "@/components/Btn";
import { IconBtn } from "@/components/IconBtn";
import { ModalShell } from "@/components/ModalShell";
import { QUEST_DETAILS, type Quest } from "@/data/quests";
import { useT } from "@/i18n/helpers";
import { useClaimState } from "@/lib/useQuests";
import type { Persona } from "@/personas";

export function QuestDialog({
  quest,
  persona,
  visible,
  onClose,
  onStart,
  onClaim,
}: {
  quest: Quest | null;
  persona: Persona;
  visible: boolean;
  onClose: () => void;
  onStart: () => void;
  onClaim: (questId: string) => void;
}) {
  const t = useT();
  const claim = useClaimState(
    quest ?? ({ id: "", progress: 0, total: 1 } as Quest),
  );
  if (!quest) return null;
  const detail = QUEST_DETAILS[quest.id] ?? {
    icon: "✨",
    accent: PB.ink,
    tipCount: 0,
  };
  const pct = Math.round((100 * quest.progress) / quest.total);
  const isWeekly = quest.kind === "weekly";

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <View style={{ padding: 18 }}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: detail.accent }]}>
            <Text style={styles.iconText}>{detail.icon}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.pillRow}>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: isWeekly ? PB.purple : PB.green },
                ]}
              >
                <Text style={[styles.pillText, { color: PB.cream }]}>
                  {isWeekly
                    ? t("quests.dialog.weeklyChip")
                    : t("quests.dialog.dailyChip")}
                </Text>
              </View>
              <View style={[styles.pill, { backgroundColor: PB.yellow }]}>
                <Text style={[styles.pillText, { color: PB.ink }]}>
                  {t("quests.dialog.xpChip", { xp: quest.reward })}
                </Text>
              </View>
            </View>
            <Text style={styles.title}>{t(`quests.labels.${quest.id}`)}</Text>
          </View>
          <IconBtn onPress={onClose} size={32} fs={14}>
            ✕
          </IconBtn>
        </View>

        <View style={styles.descBox}>
          <Text style={styles.descText}>
            {t(`quests.details.${quest.id}.desc`)}
          </Text>
        </View>

        <View style={{ marginTop: 14 }}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>
              {t("quests.dialog.progress")}
            </Text>
            <Text style={styles.progressValue}>
              {quest.progress} / {quest.total}
            </Text>
          </View>
          <View style={styles.bar}>
            <View
              style={[
                styles.fill,
                { width: `${pct}%`, backgroundColor: detail.accent },
              ]}
            />
          </View>
        </View>

        {detail.tipCount > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.section}>
              {t("quests.dialog.tipsFrom", {
                name: persona.name.toUpperCase(),
              })}
            </Text>
            <View style={{ gap: 6 }}>
              {Array.from({ length: detail.tipCount }).map((_, i) => (
                <View key={i} style={styles.tipRow}>
                  <View
                    style={[
                      styles.tipAvatar,
                      { backgroundColor: persona.avatarBg },
                    ]}
                  >
                    <Text style={{ fontSize: 12 }}>{persona.emoji}</Text>
                  </View>
                  <Text style={styles.tipText}>
                    {t(`quests.details.${quest.id}.tip${i + 1}`)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
          <Btn
            bg={PB.cream}
            color={PB.ink}
            onPress={onClose}
            style={{ flex: 1 }}
          >
            {t("quests.dialog.later")}
          </Btn>
          {claim === "claimable" ? (
            <Btn
              bg={PB.yellow}
              color={PB.ink}
              onPress={() => onClaim(quest.id)}
              style={{ flex: 1.4 }}
            >
              ✨ {t("quests.dialog.claim", { xp: quest.reward })}
            </Btn>
          ) : claim === "claimed" ? (
            <Btn
              bg={PB.cream2}
              color={PB.ink}
              onPress={onClose}
              style={{ flex: 1.4 }}
            >
              ✓ {t("quests.dialog.claimed")}
            </Btn>
          ) : (
            <Btn
              bg={PB.ink}
              color={PB.yellow}
              onPress={onStart}
              style={{ flex: 1.4 }}
            >
              {t("quests.dialog.start")}
            </Btn>
          )}
        </View>
      </View>
    </ModalShell>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderColor: PB.ink,
    borderWidth: 2.5,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 28 },
  pillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
  },
  pillText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.6 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: PB.ink,
    lineHeight: 24,
    marginTop: 6,
  },
  descBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
  },
  descText: { fontSize: 14, color: PB.ink, fontWeight: "500", lineHeight: 20 },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: PB.ink,
    letterSpacing: 0.5,
  },
  progressValue: { fontSize: 12, fontWeight: "700", color: PB.ink },
  bar: {
    marginTop: 6,
    height: 14,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: { height: "100%" },
  section: {
    fontSize: 11,
    fontWeight: "800",
    color: PB.ink,
    opacity: 0.7,
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  tipRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 10,
  },
  tipAvatar: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: PB.ink,
    fontWeight: "500",
    lineHeight: 18,
  },
});

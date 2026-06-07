import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as FileSystem from 'expo-file-system/legacy';

import {
  chatAdapter,
  chatMode,
  guardedLocalLlmChatAdapter,
  guardedWebNativeLlmChatAdapter,
  llamaRnRuntime,
  MODEL_GGUF_FILENAME,
  type ChatHistoryTurn,
  type ToolContext,
} from '@/ai';
import { generateThreadSummary, SUMMARY_THRESHOLD } from '@/ai/toolChatAdapter';
import { IconBtn } from '@/components/IconBtn';
import { BUGS, findBug } from '@/data/bugs';
import { useT } from '@/i18n/helpers';
import { xpFromClaimedQuests, xpFromDex } from '@/lib/level';
import { currentStreak } from '@/lib/streak';
import { haptics } from '@/lib/haptics';
import { searchConversationMemories } from '@/lib/conversationMemory';
import { PERSONA_META, PERSONA_IDS, type Persona } from '@/personas';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { type ChatMessage, useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Msg = { who: 'me' | 'larva'; t: string };

type ActiveChatMode = 'local' | 'cloud' | 'offline';

function resolveActiveMode(preferLocal: boolean): ActiveChatMode {
  if (preferLocal) return 'local'; // web uses Gemini Nano; native uses llamaRn
  if (chatMode === 'gemini') return 'cloud';
  return 'offline';
}

function selectLocalAdapter() {
  // On web: Chrome Built-in AI (Gemini Nano via Prompt API).
  // On iOS/Android: on-device llama.rn runtime (Larva-3B GGUF).
  return Platform.OS === 'web' ? guardedWebNativeLlmChatAdapter : guardedLocalLlmChatAdapter;
}

function initialMessages(P: Persona, mode: ActiveChatMode, topic?: string): Msg[] {
  const intro = topic ? P.lines.topicHello(topic) : P.lines.chatHello;
  if (mode === 'local' || mode === 'cloud') return [{ who: 'larva', t: intro }];
  return [
    { who: 'larva', t: intro },
    {
      who: 'larva',
      t: 'Cloud LLM is not active. Set EXPO_PUBLIC_GEMINI_API_KEY (or use a server route) to chat with Gemini.',
    },
  ];
}

export function Chat() {
  const { back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const language = useAppStore((s) => s.language);
  const profile = useAppStore((s) => s.profile);
  const dex = useAppStore((s) => s.dex);
  const catchLog = useAppStore((s) => s.catchLog);
  const followed = useAppStore((s) => s.followed);
  const questProgress = useAppStore((s) => s.questProgress);
  const questCompletedAt = useAppStore((s) => s.questCompletedAt);
  const questClaimedAt = useAppStore((s) => s.questClaimedAt);
  const chatThreads = useAppStore((s) => s.chatThreads);
  const installedRegions = useAppStore((s) => s.installedRegions);
  const setProfile = useAppStore((s) => s.setProfile);
  const saveChatThread = useAppStore((s) => s.saveChatThread);
  const indexConversationMessage = useAppStore((s) => s.indexConversationMessage);
  const clearChatThread = useAppStore((s) => s.clearChatThread);
  const updateThreadSummary = useAppStore((s) => s.updateThreadSummary);
  const removeMessageFromThread = useAppStore((s) => s.removeMessageFromThread);
  const conversationMemory = useAppStore((s) => s.conversationMemory);
  const route = useCurrentRoute();
  const topic = (route.params as { topic?: string } | undefined)?.topic;
  const P = usePersona(persona);
  const t = useT();
  const threadId = `${P.id}::${topic ?? 'general'}`;
  const storedThread = useAppStore((s) => s.chatThreads[threadId]);
  // Subscribe to the summary separately so we can use it as a dep without
  // pulling the whole thread object into every comparison.
  const threadSummary = useAppStore((s) => s.chatThreads[threadId]?.summary);

  const activeMode = resolveActiveMode(profile.localLlmOn);
  const activeChatAdapter = activeMode === 'local' ? selectLocalAdapter() : chatAdapter;

  const [msgs, setMsgs] = useState<Msg[]>(
    () =>
      (storedThread?.messages.length
        ? storedThread.messages
        : initialMessages(P, activeMode, topic)) as Msg[],
  );
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  /** Cancellation token for the in-flight `complete()` iteration. */
  const abortRef = useRef<AbortController | null>(null);
  /**
   * Guards against spawning multiple concurrent summarization requests for
   * the same thread. Flipped to true when a request is in-flight; reset on
   * error or thread change so the next threshold crossing can retry.
   */
  const summarizingRef = useRef(false);

  useEffect(() => {
    // Switching thread/persona/mode should cancel in-flight replies and load
    // the persisted transcript for that thread.
    abortRef.current?.abort();
    setTyping(false);
    summarizingRef.current = false; // allow fresh summarization on new thread
    setMsgs(
      (storedThread?.messages.length
        ? storedThread.messages
        : initialMessages(P, activeMode, topic)) as Msg[],
    );
  }, [threadId, P, topic, activeMode]);

  // Eagerly load the on-device model when local mode is active on native so
  // the first message doesn't wait for a cold-start. Silently no-ops when the
  // GGUF hasn't been downloaded yet — localLlmChatAdapter shows the prompt.
  useEffect(() => {
    if (activeMode !== 'local' || Platform.OS === 'web') return;
    const path = `${FileSystem.documentDirectory ?? ''}models/${MODEL_GGUF_FILENAME}`;
    llamaRnRuntime.load(path).catch(() => {});
  }, [activeMode]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [msgs, typing]);

  useEffect(() => {
    const persisted: ChatMessage[] = msgs.filter((m) => m.t.trim().length > 0);
    saveChatThread(threadId, persisted);

    // Background context summarization — triggered once per thread when the
    // transcript reaches SUMMARY_THRESHOLD. The summary is injected into the
    // next system prompt so the recent-turn window can be smaller without
    // losing continuity. Fire-and-forget: a failure just means no summary
    // this round; the ref resets so the next message can retry.
    const needsSummary =
      persisted.length >= SUMMARY_THRESHOLD &&
      !threadSummary &&
      !summarizingRef.current &&
      activeMode === 'cloud';

    if (needsSummary) {
      const apiKey =
        process.env.GEMINI_API_KEY ??
        (process.env.NODE_ENV !== 'production'
          ? process.env.EXPO_PUBLIC_GEMINI_API_KEY
          : undefined);

      if (apiKey) {
        summarizingRef.current = true;
        const olderTurns: ChatHistoryTurn[] = persisted
          .slice(0, -4) // keep the most recent 4 out of the summary
          .map((m) => ({
            role: (m.who === 'me' ? 'user' : 'assistant') as 'user' | 'assistant',
            text: m.t,
          }));
        generateThreadSummary(olderTurns, apiKey)
          .then((summary) => {
            if (summary) updateThreadSummary(threadId, summary);
          })
          .catch(() => {
            summarizingRef.current = false; // allow retry on next message
          });
      }
    }
  }, [msgs, threadId, saveChatThread, threadSummary, activeMode, updateThreadSummary]);

  /**
   * Streamed completion. The mock runtime yields one chunk; production
   * Llama yields one chunk per token. Either way we append into the
   * last "larva" bubble live so the user sees the answer materialise.
   */
  const send = async () => {
    const text = input.trim();
    if (!text) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setMsgs((m) => [...m, { who: 'me', t: text }]);
    setInput('');
    setTyping(true);
    indexConversationMessage(threadId, { who: 'me', t: text });

    // Reserve the assistant bubble so chunks have a place to land.
    setMsgs((m) => [...m, { who: 'larva', t: '' }]);
    let received = '';
    const xp = xpFromDex(dex) + xpFromClaimedQuests(questClaimedAt);
    const history: ChatHistoryTurn[] = msgs
      .map((m) => ({
        role: m.who === 'me' ? ('user' as const) : ('assistant' as const),
        text: m.t,
      }))
      .filter((m) => m.text.trim().length > 0);
    const recentCatches = [...catchLog]
      .sort((a, b) => b.at - a.at)
      .slice(0, 8)
      .map((e) => ({
        bugId: e.id,
        bugName: findBug(e.id)?.name ?? e.id,
        at: e.at,
      }));
    const memorySnippets = searchConversationMemories(conversationMemory, text, 6).map((hit) => ({
      threadId: hit.entry.threadId,
      who: hit.entry.who,
      text: hit.entry.text,
      at: hit.entry.createdAt,
      keywords: hit.entry.keywords,
    }));

    // Live context snapshot for tool-based adapters. Built here so tools
    // always see the current store state at the moment the user sends.
    const toolContext: ToolContext = {
      profile,
      dex,
      catchLog,
      questProgress,
      questCompletedAt,
      questClaimedAt,
      chatThreads,
      conversationMemory,
      followed,
      language,
      installedRegions,
      onUpdateSettings: setProfile,
    };

    // Queries that mention multiple distinct data sources benefit from
    // extra agentic steps. Simple heuristic — no UI needed.
    const multiSourceQuery =
      /\b(compare|both|also|and then|additionally|versus|leaderboard.+quest|quest.+leaderboard|friend.+catch|catch.+friend)\b/i.test(
        text,
      );

    try {
      for await (const chunk of activeChatAdapter.streamReply({
        persona: P,
        topic,
        userText: text,
        history,
        userContext: {
          language,
          profileName: profile.name,
          networkOn: profile.networkOn,
          locationShareOn: profile.locationShareOn,
          caughtSpecies: dex.size,
          totalSpecies: BUGS.length,
          xp,
          streakDays: currentStreak(catchLog),
          followedUsers: Array.from(followed).slice(0, 12),
          recentCatches,
        },
        memorySnippets,
        toolContext,
        threadSummary,
        maxSteps: multiSourceQuery ? 8 : undefined,
        signal: ctrl.signal,
      })) {
        if (ctrl.signal.aborted) return;
        received += chunk;
        setMsgs((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { who: 'larva', t: received };
          return copy;
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      setMsgs((m) => {
        const copy = m.slice();
        copy[copy.length - 1] = {
          who: 'larva',
          t: `LLM error: ${message}.`,
        };
        return copy;
      });
    } finally {
      if (!ctrl.signal.aborted && received.trim().length > 0) {
        indexConversationMessage(threadId, { who: 'larva', t: received.trim() });
      }
      if (!ctrl.signal.aborted) setTyping(false);
    }
  };

  const clearCurrentThread = () => {
    haptics.select();
    abortRef.current?.abort();
    setTyping(false);
    clearChatThread(threadId);
    setMsgs(initialMessages(P, activeMode, topic));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        <View style={[styles.headAvatar, { backgroundColor: P.avatarBg }]}>
          <Text style={{ fontSize: 22 }}>{P.emoji}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headName}>{P.name}</Text>
          <Text style={styles.headStatus}>
            {activeMode === 'local'
              ? Platform.OS === 'web'
                ? t('chat.webNativeStatus', { title: P.title })
                : t('chat.localStatus', { title: P.title })
              : activeMode === 'cloud'
                ? t('chat.cloudStatus', { title: P.title })
                : t('chat.offlineStatus', { title: P.title })}
          </Text>
        </View>
        <View style={styles.clearWrap}>
          <IconBtn
            onPress={clearCurrentThread}
            size={34}
            fs={14}
            bg={PB.cream}
            style={styles.clearBtn}
          >
            🗑
          </IconBtn>
          <Pressable onPress={clearCurrentThread}>
            <Text style={styles.clearText}>{t('chat.clearCta')}</Text>
          </Pressable>
        </View>
        <View style={styles.switcher}>
          {PERSONA_IDS.map((pid) => (
            <Pressable
              key={pid}
              onPress={() => {
                haptics.select();
                setPersona(pid);
              }}
              style={[
                styles.switchDot,
                {
                  backgroundColor: PERSONA_META[pid].avatarBg,
                  borderWidth: persona === pid ? 2.5 : 1.5,
                },
              ]}
            >
              <Text style={{ fontSize: 12 }}>{PERSONA_META[pid].emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
        {msgs.map((m, i) => (
          <Bubble
            key={i}
            m={m}
            onDelete={() => {
              haptics.select();
              Alert.alert(
                'Delete message',
                'Remove this message from the conversation?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      // Remove from UI first for instant feedback.
                      setMsgs((prev) => prev.filter((_, j) => j !== i));
                      // Sync to persistent store + strip from memory index.
                      removeMessageFromThread(threadId, i);
                      // Reset the summarization guard so the next message
                      // can trigger a fresh summary if needed.
                      summarizingRef.current = false;
                    },
                  },
                ],
              );
            }}
          />
        ))}
        {typing ? <TypingDots /> : null}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={PB.ink + '80'}
          style={styles.input}
        />
        <Pressable
          onPress={send}
          style={[styles.sendBtn, { backgroundColor: input.trim() ? PB.green : PB.cream2 }]}
        >
          <Text style={[styles.sendText, { color: input.trim() ? PB.cream : PB.ink }]}>→</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

type BubbleSegment = { type: 'text'; value: string } | { type: 'image'; uri: string };

function parseBubble(text: string): BubbleSegment[] {
  const segments: BubbleSegment[] = [];
  const re = /\[IMAGE:([^\]]+)\]/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(last, m.index).trim();
    if (before) segments.push({ type: 'text', value: before });
    segments.push({ type: 'image', uri: m[1]! });
    last = re.lastIndex;
  }
  const tail = text.slice(last).trim();
  if (tail) segments.push({ type: 'text', value: tail });
  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}

function Bubble({ m, onDelete }: { m: Msg; onDelete?: () => void }) {
  const isMe = m.who === 'me';
  const segments = parseBubble(m.t);
  return (
    <Pressable onLongPress={onDelete} delayLongPress={400}>
      <View
        style={[
          styles.bubble,
          {
            alignSelf: isMe ? 'flex-end' : 'flex-start',
            backgroundColor: isMe ? PB.blue : PB.cream2,
          },
        ]}
      >
        {segments.map((seg, i) =>
          seg.type === 'image' ? (
            <Image
              key={i}
              source={{ uri: seg.uri }}
              style={styles.bubbleImage}
              resizeMode="cover"
            />
          ) : (
            <Text key={i} style={[styles.bubbleText, { color: isMe ? PB.cream : PB.ink }]}>
              {seg.value}
            </Text>
          ),
        )}
      </View>
    </Pressable>
  );
}

function TypingDots() {
  const opacities = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    const loops = opacities.map((o, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(o, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(o, { toValue: 0.3, duration: 300, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [opacities]);
  return (
    <View style={styles.typing}>
      {opacities.map((o, i) => (
        <Animated.View key={i} style={[styles.typingDot, { opacity: o }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: PB.cream, paddingTop: 50 },
  head: {
    padding: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    backgroundColor: PB.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headAvatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  headName: { fontSize: 17, fontWeight: '800', color: PB.ink, lineHeight: 18 },
  headStatus: { fontSize: 11, color: PB.ink, opacity: 0.7 },
  switcher: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    paddingHorizontal: 8,
    backgroundColor: PB.cream,
    borderColor: PB.ink,
    borderWidth: 2,
    borderRadius: 99,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
  },
  clearBtn: {
    borderRadius: 999,
  },
  clearWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clearText: {
    fontSize: 11,
    fontWeight: '800',
    color: PB.ink,
  },
  switchDot: {
    width: 22,
    height: 22,
    borderRadius: 99,
    borderColor: PB.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 14, gap: 10, flexGrow: 1 },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 10,
    paddingHorizontal: 13,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 18,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  bubbleText: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  bubbleImage: {
    width: 220,
    height: 165,
    borderRadius: 10,
    marginTop: 4,
    borderColor: PB.ink,
    borderWidth: 1.5,
  },
  typing: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: PB.cream2,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 18,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: PB.ink },
  inputRow: {
    padding: 14,
    paddingBottom: 28,
    borderTopColor: PB.ink,
    borderTopWidth: 2.5,
    backgroundColor: PB.cream,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    height: 46,
    paddingHorizontal: 14,
    backgroundColor: PB.paper,
    borderColor: PB.ink,
    borderWidth: 2.5,
    borderRadius: 14,
    fontSize: 14,
    color: PB.ink,
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderColor: PB.ink,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PB.ink,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
  },
  sendText: { fontSize: 22, fontWeight: '800' },
});

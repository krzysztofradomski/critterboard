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
  useWindowDimensions,
  View,
} from 'react-native';

import {
  CHAT_MODEL,
  guardedLocalLlmChatAdapter,
  initChatModel,
  loadChatModel,
  type ChatHistoryTurn,
  type ChatModelState,
} from '@/ai';
import { Btn } from '@/components/Btn';
import { IconBtn } from '@/components/IconBtn';
import { Sticker } from '@/components/Sticker';
import { allBugs, findBug } from '@/data/bugs';
import { bugName, useT } from '@/i18n/helpers';
import { xpFromClaimedQuests, xpFromDex } from '@/lib/level';
import { currentStreak } from '@/lib/streak';
import { haptics } from '@/lib/haptics';
import { useChatModel } from '@/lib/useChatModel';
import { searchConversationMemories } from '@/lib/conversationMemory';
import { PERSONA_META, PERSONA_IDS, type Persona } from '@/personas';
import { usePersona } from '@/personas/hooks';
import { PB } from '@/tokens/pb';
import { type ChatMessage, useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Msg = { who: 'me' | 'larva'; t: string };

// Chat runs only on the on-device Gemma 4 model (downloaded in Settings).
// Until it's ready, the screen shows a gate instead of the input; there are
// no scripted replies.
function initialMessages(P: Persona, topic?: string): Msg[] {
  return [{ who: 'larva', t: topic ? P.lines.topicHello(topic) : P.lines.chatHello }];
}

export function Chat() {
  const { back, go } = useNav();
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const language = useAppStore((s) => s.language);
  const profile = useAppStore((s) => s.profile);
  const dex = useAppStore((s) => s.dex);
  const catchLog = useAppStore((s) => s.catchLog);
  const followed = useAppStore((s) => s.followed);
  const questClaimedAt = useAppStore((s) => s.questClaimedAt);
  const saveChatThread = useAppStore((s) => s.saveChatThread);
  const indexConversationMessage = useAppStore((s) => s.indexConversationMessage);
  const clearChatThread = useAppStore((s) => s.clearChatThread);
  const removeMessageFromThread = useAppStore((s) => s.removeMessageFromThread);
  const conversationMemory = useAppStore((s) => s.conversationMemory);
  const route = useCurrentRoute();
  const topic = (route.params as { topic?: string } | undefined)?.topic;
  const P = usePersona(persona);
  const t = useT();
  const threadId = `${P.id}::${topic ?? 'general'}`;
  const storedThread = useAppStore((s) => s.chatThreads[threadId]);

  const { width } = useWindowDimensions();
  const model = useChatModel();
  const chatReady = model.status === 'ready';

  const [msgs, setMsgs] = useState<Msg[]>(
    () =>
      (storedThread?.messages.length
        ? storedThread.messages
        : initialMessages(P, topic)) as Msg[],
  );
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  /** Cancellation token for the in-flight `complete()` iteration. */
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Switching thread/persona should cancel in-flight replies and load
    // the persisted transcript for that thread.
    abortRef.current?.abort();
    setTyping(false);
    setMsgs(
      (storedThread?.messages.length
        ? storedThread.messages
        : initialMessages(P, topic)) as Msg[],
    );
  }, [threadId, P, topic]);

  // Load the model if its file is on disk (no-op when already loaded/absent),
  // so the first message doesn't wait for a cold start.
  useEffect(() => {
    void initChatModel();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [msgs, typing]);

  useEffect(() => {
    const persisted: ChatMessage[] = msgs.filter((m) => m.t.trim().length > 0);
    saveChatThread(threadId, persisted);
  }, [msgs, threadId, saveChatThread]);

  /**
   * Streamed completion: Gemma yields text as it generates, appended into
   * the last "larva" bubble so the answer materialises live.
   */
  const send = async () => {
    const text = input.trim();
    if (!text || !chatReady) return;
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
        bugName: bugName(language, e.id),
        at: e.at,
      }));
    const memorySnippets = searchConversationMemories(conversationMemory, text, 6).map((hit) => ({
      threadId: hit.entry.threadId,
      who: hit.entry.who,
      text: hit.entry.text,
      at: hit.entry.createdAt,
      keywords: hit.entry.keywords,
    }));

    try {
      for await (const chunk of guardedLocalLlmChatAdapter.streamReply({
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
          totalSpecies: allBugs().length,
          xp,
          streakDays: currentStreak(catchLog),
          followedUsers: Array.from(followed).slice(0, 12),
          recentCatches,
        },
        memorySnippets,
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
    setMsgs(initialMessages(P, topic));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.head}>
        <IconBtn onPress={back}>←</IconBtn>
        {width >= 360 ? (
          <View style={[styles.headAvatar, { backgroundColor: P.avatarBg }]}>
            <Text style={{ fontSize: 22 }}>{P.emoji}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headName} numberOfLines={1}>
            {P.name}
          </Text>
          <Text style={styles.headStatus} numberOfLines={1}>
            {chatReady
              ? t('chat.localStatus', { title: P.title })
              : t('chat.lockedStatus', { title: P.title })}
          </Text>
        </View>
        <IconBtn
          onPress={clearCurrentThread}
          size={34}
          fs={14}
          bg={PB.cream}
          style={styles.clearBtn}
          accessibilityLabel={t('chat.clearCta')}
        >
          🗑
        </IconBtn>
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
                t('chat.deleteTitle'),
                t('chat.deleteBody'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: () => {
                      // Remove from UI first for instant feedback.
                      setMsgs((prev) => prev.filter((_, j) => j !== i));
                      // Sync to persistent store + strip from memory index.
                      removeMessageFromThread(threadId, i);
                    },
                  },
                ],
              );
            }}
          />
        ))}
        {typing ? <TypingDots /> : null}
      </ScrollView>

      {!chatReady ? (
        <ChatGate state={model} onOpenSettings={() => go('settings')} />
      ) : (
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
      )}
    </KeyboardAvoidingView>
  );
}

/** Shown instead of the input until Gemma 4 is downloaded and loaded. */
function ChatGate({ state, onOpenSettings }: { state: ChatModelState; onOpenSettings: () => void }) {
  const t = useT();
  const vars = { model: CHAT_MODEL.name, size: CHAT_MODEL.sizeGb, pct: state.pct };
  const busy =
    state.status === 'checking' || state.status === 'loading' || state.status === 'downloading';
  const title =
    state.status === 'unsupported' ? t('chat.gate.webTitle')
    : state.status === 'tooLittleRam' ? t('chat.gate.ramTitle')
    : state.status === 'downloading' ? t('chat.gate.downloadingTitle', vars)
    : state.status === 'ejected' ? t('chat.gate.ejectedTitle', vars)
    : busy ? t('chat.gate.loadingTitle', vars)
    : t('chat.gate.title', vars);
  const body =
    state.status === 'unsupported' ? t('chat.gate.webBody', vars)
    : state.status === 'tooLittleRam' ? t('chat.gate.ramBody', vars)
    : state.status === 'error' ? t('chat.gate.errorBody', vars)
    : state.status === 'ejected' ? t('chat.gate.ejectedBody', vars)
    : busy ? t('chat.gate.busyBody', vars)
    : t('chat.gate.body', vars);
  return (
    <View style={styles.gate}>
      <Sticker bg={PB.cream} rotate={-1} style={{ padding: 16 }}>
        <Text style={styles.gateTitle}>{title}</Text>
        <Text style={styles.gateBody}>{body}</Text>
        {state.status === 'ejected' ? (
          <Btn full bg={PB.ink} color={PB.yellow} onPress={() => void loadChatModel()} style={{ marginTop: 12 }}>
            {t('chat.gate.loadCta')}
          </Btn>
        ) : null}
        {state.status === 'absent' || state.status === 'error' ? (
          <Btn full bg={PB.ink} color={PB.yellow} onPress={onOpenSettings} style={{ marginTop: 12 }}>
            {t('chat.gate.cta')}
          </Btn>
        ) : null}
      </Sticker>
    </View>
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
  root: { ...StyleSheet.absoluteFill, backgroundColor: PB.cream, paddingTop: 50 },
  head: {
    padding: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomColor: PB.ink,
    borderBottomWidth: 2.5,
    backgroundColor: PB.yellow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  gate: {
    padding: 14,
    paddingBottom: 28,
    borderTopColor: PB.ink,
    borderTopWidth: 2.5,
    backgroundColor: PB.cream,
  },
  gateTitle: { fontSize: 17, fontWeight: '800', color: PB.ink },
  gateBody: { fontSize: 13, color: PB.ink, marginTop: 6, lineHeight: 18 },
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

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { IconBtn } from '@/components/IconBtn';
import { PERSONAS, PERSONA_IDS, type Persona } from '@/personas';
import { PB } from '@/tokens/pb';
import { complete } from '@/ai/chat';
import { useAppStore, useCurrentRoute } from '@/store/useAppStore';
import { useNav } from '@/store/useNav';

type Msg = { who: 'me' | 'larva'; t: string };

function initialMessages(P: Persona, topic?: string): Msg[] {
  if (topic) return [{ who: 'larva', t: P.lines.topicHello(topic) }];
  return [{ who: 'larva', t: P.lines.chatHello }];
}

export function Chat() {
  const { go, back } = useNav();
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const route = useCurrentRoute();
  const topic = (route.params as { topic?: string } | undefined)?.topic;
  const P = PERSONAS[persona];

  const [msgs, setMsgs] = useState<Msg[]>(() => initialMessages(P, topic));
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const personaRef = useRef(P.id);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (personaRef.current !== P.id) {
      personaRef.current = P.id;
      setMsgs(initialMessages(P, topic));
    }
  }, [P.id, P, topic]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [msgs, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setMsgs((m) => [...m, { who: 'me', t: text }]);
    setInput('');
    setTyping(true);

    let reply: string | null = null;
    try {
      reply = await complete(P, text);
    } catch {
      // fall through to canned line
    }
    if (!reply) {
      const fallback = P.canned[Math.floor(Math.random() * P.canned.length)];
      reply = fallback ?? '...';
    }
    setTyping(false);
    setMsgs((m) => [...m, { who: 'larva', t: reply as string }]);
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
          <Text style={styles.headStatus}>● local · {P.title}</Text>
        </View>
        <View style={styles.switcher}>
          {PERSONA_IDS.map((pid) => (
            <Pressable
              key={pid}
              onPress={() => setPersona(pid)}
              style={[
                styles.switchDot,
                {
                  backgroundColor: PERSONAS[pid].avatarBg,
                  borderWidth: persona === pid ? 2.5 : 1.5,
                },
              ]}
            >
              <Text style={{ fontSize: 12 }}>{PERSONAS[pid].emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
        {msgs.map((m, i) => (
          <Bubble key={i} m={m} />
        ))}
        {typing ? <TypingDots /> : null}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={send}
          returnKeyType="send"
          placeholder="Ask about this bug..."
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

function Bubble({ m }: { m: Msg }) {
  const isMe = m.who === 'me';
  return (
    <View
      style={[
        styles.bubble,
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: isMe ? PB.blue : PB.cream2,
        },
      ]}
    >
      <Text style={[styles.bubbleText, { color: isMe ? PB.cream : PB.ink }]}>{m.t}</Text>
    </View>
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

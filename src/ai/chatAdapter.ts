import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

import { BUGS } from '@/data/bugs';
import { buildPrompt, llamaRnRuntime, mockRuntime } from '@/ai/llm';
import type { Persona } from '@/personas';

export type ChatHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type ChatCatchSummary = {
  bugId: string;
  bugName: string;
  at: number;
};

export type ChatUserContext = {
  language: string;
  profileName: string;
  networkOn: boolean;
  locationShareOn: boolean;
  caughtSpecies: number;
  totalSpecies: number;
  xp: number;
  streakDays: number;
  followedUsers: string[];
  recentCatches: ChatCatchSummary[];
};

export type ChatMemorySnippet = {
  threadId: string;
  who: 'me' | 'larva';
  text: string;
  at: number;
  keywords: string[];
};

export type ChatReplyParams = {
  persona: Persona;
  topic?: string;
  userText: string;
  history: ChatHistoryTurn[];
  userContext: ChatUserContext;
  memorySnippets?: ChatMemorySnippet[];
  signal?: AbortSignal;
};

export interface ChatAdapter {
  streamReply(params: ChatReplyParams): AsyncIterable<string>;
  ready(): boolean;
}

const INSECT_DATASET_PROMPT = BUGS.map(
  (b) =>
    `- ${b.id}: ${b.name} (${b.latin}), rarity=${b.rarity}, xp=${b.xp}, traits=${b.traits.join(',') || 'none'}`,
).join('\n');

function geminiApiKey(): string {
  const serverKey = process.env.GEMINI_API_KEY;
  if (serverKey) return serverKey;
  const clientKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (clientKey) {
    // EXPO_PUBLIC_ vars are bundled into the app binary and readable by
    // anyone who decompiles it. Only permit in development; production
    // builds must proxy Gemini requests through the Cloudflare Worker.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'EXPO_PUBLIC_GEMINI_API_KEY must not be used in production builds. ' +
          'Proxy Gemini requests through the Cloudflare Worker instead.',
      );
    }
    return clientKey;
  }
  throw new Error('GEMINI_API_KEY is missing');
}

function buildSystemPrompt(
  persona: Persona,
  topic: string | undefined,
  ctx: ChatUserContext,
  memorySnippets: ChatMemorySnippet[] = [],
): string {
  const recent = ctx.recentCatches.length
    ? ctx.recentCatches
        .map((c) => `${c.bugName} (${c.bugId}) @ ${new Date(c.at).toISOString()}`)
        .join('\n')
    : '- none yet';

  const follows = ctx.followedUsers.length ? ctx.followedUsers.join(', ') : 'none';
  const memoryBlock = memorySnippets.length
    ? memorySnippets
        .slice(0, 6)
        .map((m) => {
          const role = m.who === 'me' ? 'user' : 'assistant';
          const tags = m.keywords.length ? ` #${m.keywords.join(' #')}` : '';
          return `- [${new Date(m.at).toISOString()} | ${m.threadId} | ${role}] ${m.text}${tags}`;
        })
        .join('\n')
    : '- none retrieved';

  return [
    persona.systemPrompt,
    '',
    'You are inside Critterboard, a privacy-first insect ID app.',
    `Current user language: ${ctx.language}. Reply in that language unless the user asks otherwise.`,
    'Keep answers concise (1-3 short sentences) unless the user explicitly asks for depth.',
    '',
    `Topic focus: ${topic ?? 'general insect chat'}`,
    '',
    'User context (live app state):',
    `- profileName: ${ctx.profileName}`,
    `- networkOn: ${ctx.networkOn}`,
    `- locationShareOn: ${ctx.locationShareOn}`,
    `- caughtSpecies: ${ctx.caughtSpecies}/${ctx.totalSpecies}`,
    `- xp: ${ctx.xp}`,
    `- streakDays: ${ctx.streakDays}`,
    `- followedUsers: ${follows}`,
    `- recentCatches:\n${recent}`,
    '',
    'Retrieved conversation memory (cross-thread):',
    memoryBlock,
    '',
    'Known insects dataset in this build:',
    INSECT_DATASET_PROMPT,
    '',
    'Never claim this is authoritative biological advice. If uncertain, say so briefly.',
  ].join('\n');
}

function toConversation(history: ChatHistoryTurn[], userText: string) {
  const trimmed = history
    .filter((h) => h.text.trim().length > 0)
    .slice(-12)
    .map((h) => ({
      role: h.role,
      content: h.text,
    }));

  return [...trimmed, { role: 'user' as const, content: userText }];
}

export const mockChatAdapter: ChatAdapter = {
  async *streamReply(params) {
    for await (const chunk of mockRuntime.completeWithPersona(
      params.persona,
      params.userText,
      params.topic,
    )) {
      if (params.signal?.aborted) return;
      yield chunk;
    }
  },
  ready() {
    return true;
  },
};

export const geminiChatAdapter: ChatAdapter = {
  async *streamReply(params) {
    const google = createGoogleGenerativeAI({ apiKey: geminiApiKey() });
    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: buildSystemPrompt(
        params.persona,
        params.topic,
        params.userContext,
        params.memorySnippets,
      ),
      messages: toConversation(params.history, params.userText),
      temperature: 0.7,
      abortSignal: params.signal,
    });

    for await (const chunk of result.textStream) {
      if (params.signal?.aborted) return;
      yield chunk;
    }
  },
  ready() {
    return Boolean(
      process.env.GEMINI_API_KEY ??
        (process.env.NODE_ENV !== 'production' ? process.env.EXPO_PUBLIC_GEMINI_API_KEY : undefined),
    );
  },
};

/**
 * On-device LLM adapter. Wraps `llamaRnRuntime` (llama.cpp via llama.rn).
 *
 * When the model binary isn't loaded yet — either because the GGUF file
 * hasn't been downloaded or the native module isn't wired — it surfaces a
 * prompt to the user inside the chat bubble rather than silently failing.
 * This gives a graceful degradation path until the on-device model ships.
 */
export const localLlmChatAdapter: ChatAdapter = {
  async *streamReply(params) {
    if (!llamaRnRuntime.ready()) {
      yield 'On-device model not loaded yet. Download Larva-3B from Settings → On-device Brains to enable private, offline chat.';
      return;
    }
    const prompt = buildPrompt(params.persona, params.userText, params.topic);
    for await (const chunk of llamaRnRuntime.complete(prompt, { signal: params.signal })) {
      if (params.signal?.aborted) return;
      yield chunk;
    }
  },
  ready() {
    return llamaRnRuntime.ready();
  },
};

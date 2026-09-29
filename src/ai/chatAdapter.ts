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

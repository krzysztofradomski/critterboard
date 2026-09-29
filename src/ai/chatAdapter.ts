import { buildMessages, llamaRnRuntime } from '@/ai/llm';
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

/**
 * On-device chat with Gemma 4 (llama.rn). Chat.tsx only offers the input once
 * the model is ready, so a not-ready call is a programming error.
 */
export const localLlmChatAdapter: ChatAdapter = {
  async *streamReply(params) {
    if (!llamaRnRuntime.ready()) throw new Error('chat model not loaded');
    const messages = buildMessages({
      persona: params.persona,
      userText: params.userText,
      language: params.userContext.language,
      topic: params.topic,
      history: params.history,
    });
    for await (const chunk of llamaRnRuntime.complete(messages, { signal: params.signal })) {
      if (params.signal?.aborted) return;
      yield chunk;
    }
  },
  ready() {
    return llamaRnRuntime.ready();
  },
};

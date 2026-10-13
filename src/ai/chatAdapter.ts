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

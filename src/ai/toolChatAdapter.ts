import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

import type { ChatAdapter, ChatReplyParams } from '@/ai/chatAdapter';
import type { Persona } from '@/personas';
import { buildChatTools, type ToolContext } from '@/ai/tools';

function geminiApiKey(): string {
  const serverKey = process.env.GEMINI_API_KEY;
  if (serverKey) return serverKey;
  const clientKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (clientKey) {
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
  language: string,
): string {
  return [
    persona.systemPrompt,
    '',
    'You are inside Critterboard, a privacy-first insect ID app.',
    `Current user language: ${language}. Reply in that language unless the user asks otherwise.`,
    `Topic focus: ${topic ?? 'general insect chat'}`,
    '',
    'Use your tools to answer questions about:',
    '  - The user\'s catches, stats, XP, streak, dex completion → getUserStats',
    '  - Active or completed quests → getQuests',
    '  - Leaderboard rankings → getLeaderboard',
    '  - Friends and social feed → getFriendsList, getSocialFeed',
    '  - Specific insect species, traits, or rarity → getInsectInfo',
    '  - App settings → getUserSettings / updateUserSettings',
    '  - Map pins / GPS catches → getMapMarkers',
    '  - Past conversations → searchChatMemory',
    '  - Today\'s featured bug → getBugOfDay',
    '',
    'Fetch live data from tools rather than guessing. Keep answers concise (1-3 sentences)',
    'unless the user explicitly asks for depth. Never claim this is authoritative biological',
    'advice — if uncertain, say so briefly.',
  ].join('\n');
}

function toMessages(
  history: ChatReplyParams['history'],
  userText: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return [
    ...history
      .filter((h) => h.text.trim().length > 0)
      .slice(-12)
      .map((h) => ({ role: h.role, content: h.text })),
    { role: 'user' as const, content: userText },
  ];
}

/**
 * Factory: returns a ChatAdapter that uses the AI SDK tool-calling loop.
 * The model fetches live app state via tools instead of receiving it all
 * in the system prompt — cleaner, more accurate, and model-agnostic.
 *
 * @param model   Gemini model ID (default: gemini-2.5-flash)
 * @param maxSteps Max agentic tool-call rounds before forcing a text reply
 */
export function createToolChatAdapter(
  model: string = 'gemini-2.5-flash',
  maxSteps = 5,
): ChatAdapter {
  return {
    async *streamReply(params: ChatReplyParams): AsyncIterable<string> {
      const ctx: ToolContext | undefined = params.toolContext;
      if (!ctx) {
        yield 'Tool context missing — pass toolContext in ChatReplyParams to use tool-based chat.';
        return;
      }

      const google = createGoogleGenerativeAI({ apiKey: geminiApiKey() });
      const tools = buildChatTools(ctx);

      const result = streamText({
        model: google(model),
        system: buildSystemPrompt(params.persona, params.topic, ctx.language),
        messages: toMessages(params.history, params.userText),
        tools,
        maxSteps,
        temperature: 0.7,
        abortSignal: params.signal,
      });

      for await (const chunk of result.textStream) {
        if (params.signal?.aborted) return;
        yield chunk;
      }
    },

    ready(): boolean {
      return Boolean(
        process.env.GEMINI_API_KEY ??
          (process.env.NODE_ENV !== 'production'
            ? process.env.EXPO_PUBLIC_GEMINI_API_KEY
            : undefined),
      );
    },
  };
}

/** Default singleton wired to gemini-2.5-flash with 5-step agentic loop. */
export const toolChatAdapter: ChatAdapter = createToolChatAdapter();

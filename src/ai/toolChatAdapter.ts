import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';

import type { ChatAdapter, ChatReplyParams, ChatHistoryTurn } from '@/ai/chatAdapter';
import type { Persona } from '@/personas';
import { buildChatTools, type ToolContext } from '@/ai/tools';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of persisted messages that triggers background summarization.
 * At 10 messages (5 full exchanges) the transcript is long enough that
 * compressing it saves meaningful tokens on every subsequent call.
 */
export const SUMMARY_THRESHOLD = 10;

/**
 * When a summary exists, only the most recent turns are sent — the
 * summary carries everything older. Keeping 4 turns (2 exchanges) gives
 * the model enough immediate context without redundancy.
 */
const RECENT_TURNS_WITH_SUMMARY = 4;

/** Full window used when there is no summary yet. */
const FULL_WINDOW = 12;

// ---------------------------------------------------------------------------
// API key helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Pure helpers — exported so they can be unit-tested without mocking the LLM
// ---------------------------------------------------------------------------

/**
 * Build the system prompt. When a `threadSummary` is provided it is
 * injected above the tool-use instructions so the model has full context
 * even though only the most recent turns are passed as messages.
 */
export function buildSystemPrompt(
  persona: Persona,
  topic: string | undefined,
  language: string,
  threadSummary?: string,
): string {
  return [
    persona.systemPrompt,
    '',
    'You are inside Critterboard, a privacy-first insect ID app.',
    `Current user language: ${language}. Reply in that language unless the user asks otherwise.`,
    `Topic focus: ${topic ?? 'general insect chat'}`,
    '',
    ...(threadSummary
      ? [
          'Earlier conversation summary (context before the current window):',
          threadSummary,
          '',
        ]
      : []),
    'Use your tools to answer questions about:',
    "  - The user's catches, stats, XP, streak, dex completion → getUserStats",
    '  - Active or completed quests → getQuests',
    '  - Leaderboard rankings → getLeaderboard',
    '  - Friends and social feed → getFriendsList, getSocialFeed',
    '  - Specific insect species, traits, or rarity → getInsectInfo',
    '  - App settings → getUserSettings / updateUserSettings',
    '  - Map pins / GPS catches → getMapMarkers',
    '  - Past conversations → searchChatMemory',
    "  - Today's featured bug → getBugOfDay",
    '  - A photo of a specific insect → getInsectPhoto',
    '',
    'When getInsectPhoto returns a uri, include exactly [IMAGE:uri] on its own line in your',
    'reply so the app can render the photo inline. Do not wrap it in markdown or backticks.',
    '',
    'Fetch live data from tools rather than guessing. Keep answers concise (1-3 sentences)',
    'unless the user explicitly asks for depth. Never claim this is authoritative biological',
    'advice — if uncertain, say so briefly.',
  ].join('\n');
}

/**
 * Convert history turns into the messages array sent to the model.
 * When a summary is present only the most recent turns are included —
 * the summary carries the older context via the system prompt.
 */
export function toMessages(
  history: ChatReplyParams['history'],
  userText: string,
  hasSummary = false,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const windowSize = hasSummary ? RECENT_TURNS_WITH_SUMMARY : FULL_WINDOW;
  return [
    ...history
      .filter((h) => h.text.trim().length > 0)
      .slice(-windowSize)
      .map((h) => ({ role: h.role, content: h.text })),
    { role: 'user' as const, content: userText },
  ];
}

// ---------------------------------------------------------------------------
// Background summarization
// ---------------------------------------------------------------------------

/**
 * Ask the model to distil older conversation turns into a compact
 * factual summary. Called fire-and-forget from Chat.tsx after the
 * transcript grows past SUMMARY_THRESHOLD; the result is stored in the
 * thread and injected into subsequent system prompts via `threadSummary`.
 *
 * Uses temperature=0 and a tight token budget so it's deterministic and
 * cheap — a summary should never itself be a conversation.
 */
export async function generateThreadSummary(
  olderTurns: ChatHistoryTurn[],
  apiKey: string,
  model = 'gemini-2.5-flash',
): Promise<string> {
  if (olderTurns.length === 0) return '';
  const google = createGoogleGenerativeAI({ apiKey });
  const transcript = olderTurns
    .map((h) => `${h.role === 'user' ? 'User' : 'Guide'}: ${h.text}`)
    .join('\n');

  const { text } = await generateText({
    model: google(model),
    prompt: [
      'Summarize this insect-ID app conversation in 2-3 factual sentences.',
      'Preserve: species discussed, user preferences, facts established, questions resolved.',
      'Be compact — this summary will replace the older turns in future model context.',
      '',
      transcript,
    ].join('\n'),
    maxTokens: 200,
    temperature: 0,
  });

  return text.trim();
}

// ---------------------------------------------------------------------------
// Adapter factory
// ---------------------------------------------------------------------------

/**
 * Returns a ChatAdapter that uses the AI SDK tool-calling loop.
 *
 * Key behaviours vs the legacy geminiChatAdapter:
 *   - App state is fetched on-demand via tools, not pre-stuffed into the prompt.
 *   - When `params.threadSummary` is set, old turns are compressed to 4.
 *   - `params.maxSteps` overrides the factory default per-request.
 *   - `onStepFinish` logs tool calls in development for observability.
 *
 * @param model      Gemini model ID (default: gemini-2.5-flash)
 * @param maxSteps   Factory-level step ceiling (overridable per-request)
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
      const effectiveMaxSteps = params.maxSteps ?? maxSteps;
      const hasSummary = Boolean(params.threadSummary);

      const result = streamText({
        model: google(model),
        system: buildSystemPrompt(params.persona, params.topic, ctx.language, params.threadSummary),
        messages: toMessages(params.history, params.userText, hasSummary),
        tools,
        maxSteps: effectiveMaxSteps,
        temperature: 0.7,
        abortSignal: params.signal,
        onStepFinish: (step) => {
          if (process.env.NODE_ENV !== 'production' && step.toolCalls.length > 0) {
            const names = step.toolCalls.map((tc) => tc.toolName).join(', ');
            console.debug(`[toolChat] step ${step.stepType} — tools: ${names}`);
          }
        },
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

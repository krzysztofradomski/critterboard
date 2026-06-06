/**
 * Critterboard chat evals — run locally with: npx evalite
 *
 * Compares models on key chat scenarios across all three personas.
 * Uses the tool-based adapter so evals exercise the full agentic loop.
 *
 * Requires:
 *   GEMINI_API_KEY (or EXPO_PUBLIC_GEMINI_API_KEY in dev)
 *
 * Models under test (edit MODELS_UNDER_TEST to compare):
 *   - gemini-2.5-flash (fast, default)
 *   - gemini-2.5-pro   (strong, slower)
 *   - gemini-2.0-flash (leaner)
 */

import path from 'path';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { evalite } from 'evalite';
import { Levenshtein, Factuality, ExactMatch, NumericDiff } from 'autoevals';

// Resolve @ alias manually (no bundler in eval runtime)
import { buildChatTools, type ToolContext } from '../src/ai/tools';
import { getPersona } from '../src/personas';
import { BUGS } from '../src/data/bugs';
import { QUESTS } from '../src/data/quests';
import type { PersonaId } from '../src/personas';

// ---------------------------------------------------------------------------
// Models to compare — add/remove to taste
// ---------------------------------------------------------------------------

const MODELS_UNDER_TEST = [
  'gemini-2.5-flash',
  // 'gemini-2.5-pro',
  // 'gemini-2.0-flash',
] as const;

// ---------------------------------------------------------------------------
// Shared mock context
// ---------------------------------------------------------------------------

const MOCK_CTX: ToolContext = {
  profile: {
    name: 'BugHunter42',
    networkOn: false,
    leaderboardOn: true,
    locationShareOn: false,
    crashReportingOn: false,
    localLlmOn: false,
  },
  dex: new Set(['hcat', 'lady', 'buff', 'brim', 'peac', 'wasp', 'gshb']),
  catchLog: [
    { id: 'hcat', at: Date.now() - 86_400_000, lat: 51.5, lng: -0.1 },
    { id: 'lady', at: Date.now() - 3_600_000 },
    { id: 'buff', at: Date.now() - 1_800_000 },
  ],
  questProgress: { q1: 2, q2: 0, q3: 0, q4: 4 },
  questCompletedAt: {},
  questClaimedAt: {},
  chatThreads: {},
  conversationMemory: [
    {
      id: 'm1',
      threadId: 'larva::general',
      who: 'me',
      text: 'I spotted a stag beetle in the garden',
      keywords: ['stag', 'beetle', 'garden'],
      createdAt: Date.now() - 7_200_000,
    },
  ],
  followed: new Set(['mothwhisperer', 'bug_dad_42']),
  language: 'en',
  installedRegions: ['eu-ce'],
};

// ---------------------------------------------------------------------------
// Task runner
// ---------------------------------------------------------------------------

async function runChat(
  model: string,
  personaId: PersonaId,
  userMessage: string,
): Promise<string> {
  const apiKey =
    process.env.GEMINI_API_KEY ??
    (process.env.NODE_ENV !== 'production' ? process.env.EXPO_PUBLIC_GEMINI_API_KEY : undefined);

  if (!apiKey) throw new Error('GEMINI_API_KEY is required to run evals');

  const google = createGoogleGenerativeAI({ apiKey });
  const persona = getPersona('en', personaId);
  const tools = buildChatTools(MOCK_CTX);

  const result = streamText({
    model: google(model),
    system: [
      persona.systemPrompt,
      '',
      'You are inside Critterboard, a privacy-first insect ID app.',
      'Use tools to answer questions about the user\'s data. Keep answers concise.',
    ].join('\n'),
    messages: [{ role: 'user', content: userMessage }],
    tools,
    maxSteps: 3,
    temperature: 0.3,
  });

  let text = '';
  for await (const chunk of result.textStream) text += chunk;
  return text.trim();
}

// ---------------------------------------------------------------------------
// Eval 1 — Insect knowledge (tool: getInsectInfo)
// ---------------------------------------------------------------------------

evalite.each(MODELS_UNDER_TEST.map((m) => ({ name: m, input: m })))(
  'Insect knowledge — getInsectInfo',
  {
    data: async () => [
      {
        input: { persona: 'larva' as PersonaId, q: 'What XP do I get for catching a Stag Beetle?' },
        expected: '120',
      },
      {
        input: { persona: 'snail' as PersonaId, q: 'Which insects in the app are pollinators?' },
        expected: 'Honey Bee',
      },
      {
        input: { persona: 'maywind' as PersonaId, q: 'What is the rarest insect in the app?' },
        expected: 'legendary',
      },
      {
        input: { persona: 'larva' as PersonaId, q: 'What is the latin name for the Peacock Butterfly?' },
        expected: 'Aglais io',
      },
    ],
    task: async ({ persona, q }, { variant: model }) => runChat(model, persona, q),
    scorers: [Factuality],
  },
);

// ---------------------------------------------------------------------------
// Eval 2 — User stats (tool: getUserStats)
// ---------------------------------------------------------------------------

evalite.each(MODELS_UNDER_TEST.map((m) => ({ name: m, input: m })))(
  'User stats — getUserStats',
  {
    data: async () => [
      {
        input: { persona: 'snail' as PersonaId, q: 'How many species have I caught?' },
        expected: '7',
      },
      {
        input: { persona: 'larva' as PersonaId, q: 'How many species are left to catch?' },
        expected: String(BUGS.length - 7),
      },
      {
        input: { persona: 'maywind' as PersonaId, q: 'How many people do I follow?' },
        expected: '2',
      },
    ],
    task: async ({ persona, q }, { variant: model }) => runChat(model, persona, q),
    scorers: [Factuality],
  },
);

// ---------------------------------------------------------------------------
// Eval 3 — Quest awareness (tool: getQuests)
// ---------------------------------------------------------------------------

evalite.each(MODELS_UNDER_TEST.map((m) => ({ name: m, input: m })))(
  'Quest awareness — getQuests',
  {
    data: async () => [
      {
        input: { persona: 'larva' as PersonaId, q: 'How many active quests do I have?' },
        expected: String(QUESTS.length),
      },
      {
        input: { persona: 'snail' as PersonaId, q: 'What is my progress on quest q1?' },
        expected: '2',
      },
    ],
    task: async ({ persona, q }, { variant: model }) => runChat(model, persona, q),
    scorers: [Factuality],
  },
);

// ---------------------------------------------------------------------------
// Eval 4 — Settings awareness (tool: getUserSettings)
// ---------------------------------------------------------------------------

evalite.each(MODELS_UNDER_TEST.map((m) => ({ name: m, input: m })))(
  'Settings awareness — getUserSettings',
  {
    data: async () => [
      {
        input: { persona: 'larva' as PersonaId, q: 'Is my network currently on or off?' },
        expected: 'off',
      },
      {
        input: { persona: 'snail' as PersonaId, q: 'What is my display name?' },
        expected: 'BugHunter42',
      },
      {
        input: { persona: 'maywind' as PersonaId, q: 'Am I visible on the leaderboard?' },
        expected: 'yes',
      },
    ],
    task: async ({ persona, q }, { variant: model }) => runChat(model, persona, q),
    scorers: [Factuality],
  },
);

// ---------------------------------------------------------------------------
// Eval 5 — Persona tone (no tool required — pure generation quality)
// ---------------------------------------------------------------------------

evalite('Persona tone quality', {
  data: async () => [
    {
      input: { persona: 'larva' as PersonaId, q: 'Tell me something cool about beetles.' },
      expected: 'sardonic or sarcastic tone',
    },
    {
      input: { persona: 'snail' as PersonaId, q: 'Tell me something cool about beetles.' },
      expected: 'warm and calm tone',
    },
    {
      input: { persona: 'maywind' as PersonaId, q: 'Tell me something cool about beetles.' },
      expected: 'enthusiastic or joyful tone',
    },
  ],
  task: async ({ persona, q }) => runChat(MODELS_UNDER_TEST[0], persona, q),
  scorers: [Factuality],
});

// ---------------------------------------------------------------------------
// Eval 6 — Leaderboard (tool: getLeaderboard)
// ---------------------------------------------------------------------------

evalite.each(MODELS_UNDER_TEST.map((m) => ({ name: m, input: m })))(
  'Leaderboard — getLeaderboard',
  {
    data: async () => [
      {
        input: { persona: 'larva' as PersonaId, q: 'Who is rank 1 on the leaderboard?' },
        expected: 'mothwhisperer',
      },
      {
        input: { persona: 'snail' as PersonaId, q: 'How many XP does rank 1 have?' },
        expected: '48230',
      },
    ],
    task: async ({ persona, q }, { variant: model }) => runChat(model, persona, q),
    scorers: [Factuality],
  },
);

// ---------------------------------------------------------------------------
// Eval 7 — Memory search (tool: searchChatMemory)
// ---------------------------------------------------------------------------

evalite.each(MODELS_UNDER_TEST.map((m) => ({ name: m, input: m })))(
  'Chat memory — searchChatMemory',
  {
    data: async () => [
      {
        input: {
          persona: 'larva' as PersonaId,
          q: 'Did I mention anything about stag beetles before?',
        },
        expected: 'yes',
      },
    ],
    task: async ({ persona, q }, { variant: model }) => runChat(model, persona, q),
    scorers: [Factuality],
  },
);

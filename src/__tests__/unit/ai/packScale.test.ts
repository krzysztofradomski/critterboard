import { describe, expect, it, vi } from 'vitest';

// export.ts / geminiVision.ts import the legacy file-system API, which the
// shared setup doesn't mock (the real one pulls in react-native).
vi.mock('expo-file-system/legacy', () => ({ documentDirectory: null }));

import { parseCandidates } from '@/ai/geminiVision';
import { MAX_TOOL_RESULTS, buildChatTools, type ToolContext } from '@/ai/tools';
import { BUGS, allBugs, mergeBugs, type Bug } from '@/data/bugs';
import { buildDexJson } from '@/lib/export';

// 40 pack species on top of the 20 bundled ones → more than the tool cap.
const PACK: Bug[] = Array.from({ length: 40 }, (_, i) => ({
  id: `pack-${i}`, name: `Pack Moth ${i}`, latin: `Packus mothus${i}`, rarity: 'epic',
  xp: 150, tier: '★★★★', emoji: '🦋', color: '#e8903a', traits: [],
}));
mergeBugs(PACK);

async function exec(tool: { execute?: Function }, input: unknown): Promise<any> {
  return tool.execute!(input, { toolCallId: 't', messages: [] });
}

function ctx(dex: string[]): ToolContext {
  return {
    dex: new Set(dex), catchLog: [], activityLog: [], questProgress: {}, questClaimedAt: {},
    followed: new Set(), profile: { name: 'T' }, persona: 'larva', language: 'en', memory: [],
  } as unknown as ToolContext;
}

describe('chat tools with a large pack', () => {
  it('getInsectInfo caps results and lists caught species first', async () => {
    const tools = buildChatTools(ctx(['pack-39']));
    const res = await exec(tools.getInsectInfo, {});
    expect(res).toHaveLength(MAX_TOOL_RESULTS);
    expect(res[0].id).toBe('pack-39');
  });

  it('getInsectInfo finds pack species by name and the epic tier', async () => {
    const tools = buildChatTools(ctx([]));
    expect((await exec(tools.getInsectInfo, { nameLike: 'pack moth 7' }))[0].id).toBe('pack-7');
    const epic = await exec(tools.getInsectInfo, { rarity: 'epic' });
    expect(epic.length).toBeGreaterThan(0);
    expect(epic.every((b: { rarity: string }) => b.rarity === 'epic')).toBe(true);
  });

  it('getAvailableImages caps the full catalogue', async () => {
    const tools = buildChatTools(ctx([]));
    expect(await exec(tools.getAvailableImages, { caughtOnly: false })).toHaveLength(MAX_TOOL_RESULTS);
  });

  it('getUserStats counts pack species in the total', async () => {
    const tools = buildChatTools(ctx(['hcat']));
    const res = await exec(tools.getUserStats, {});
    expect(res.totalSpecies).toBe(allBugs().length);
    expect(res.totalSpecies).toBe(BUGS.length + PACK.length);
  });
});

describe('Gemini catalogue', () => {
  it('accepts pack species ids and drops unknown ones', () => {
    const out = parseCandidates('[{"bugId":"pack-3","confidence":0.9},{"bugId":"made-up","confidence":0.8}]', 3);
    expect(out).toEqual([{ bugId: 'pack-3', confidence: 0.9 }]);
  });
});

describe('dex export', () => {
  it('includes pack species in species list and total', () => {
    const blob = buildDexJson(new Set(['pack-5']), [], 'en', 'Tester', 0);
    const payload = JSON.parse(blob.body);
    expect(payload.total).toBe(allBugs().length);
    expect(payload.species.find((s: { id: string }) => s.id === 'pack-5').caught).toBe(true);
  });
});

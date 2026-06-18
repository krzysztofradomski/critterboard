import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildChatTools, type ToolContext } from '@/ai/tools';
import { BUGS } from '@/data/bugs';
import { QUESTS, COMPLETED_QUESTS } from '@/data/quests';

import type { ToolExecutionOptions } from 'ai';

const TEST_TOOL_OPTIONS: ToolExecutionOptions = {
  toolCallId: 'test-call',
  messages: [],
};

async function execTool(tool: { execute?: Function }, input: unknown): Promise<any> {
  if (!tool.execute) throw new Error('Tool has no execute function');
  return tool.execute(input, TEST_TOOL_OPTIONS);
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    profile: {
      name: 'Tester',
      networkOn: false,
      leaderboardOn: true,
      locationShareOn: false,
      crashReportingOn: false,
      localLlmOn: false,
    },
    dex: new Set(['hcat', 'lady', 'buff', 'brim']),
    catchLog: [
      { id: 'hcat', at: 1_700_000_000_000, lat: 51.5, lng: -0.1 },
      { id: 'lady', at: 1_700_100_000_000, photoUri: 'file://photo.jpg' },
      { id: 'buff', at: 1_700_200_000_000 },
    ],
    questProgress: { q1: 2, q2: 1, q3: 0, q4: 3 },
    questCompletedAt: { q2: 1_700_150_000_000 },
    questClaimedAt: { q2: 1_700_160_000_000 },
    chatThreads: {
      'larva::general': {
        messages: [
          { who: 'me', t: 'Hello there' },
          { who: 'larva', t: 'Greetings, trainee.' },
        ],
        updatedAt: 1_700_000_000_000,
      },
    },
    conversationMemory: [
      {
        id: 'mem-1',
        threadId: 'larva::general',
        who: 'me',
        text: 'I love catching beetles',
        keywords: ['love', 'catching', 'beetles'],
        createdAt: 1_700_000_000_000,
      },
      {
        id: 'mem-2',
        threadId: 'larva::general',
        who: 'larva',
        text: 'Beetles are fascinating insects',
        keywords: ['beetles', 'fascinating', 'insects'],
        createdAt: 1_700_000_001_000,
      },
    ],
    followed: new Set(['mothwhisperer', 'bug_dad_42']),
    language: 'en',
    installedRegions: ['eu-ce'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getChatHistory
// ---------------------------------------------------------------------------

describe('getChatHistory (U-CT-history-*)', () => {
  it('U-CT-history-01: returns messages for an existing thread', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getChatHistory, { threadId: 'larva::general' });
    expect(result.found).toBe(true);
    expect(result.messages).toHaveLength(2);
  });

  it('U-CT-history-02: returns found=false for missing thread', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getChatHistory, { threadId: 'snail::beetles' });
    expect(result.found).toBe(false);
    expect(result.messages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// searchChatMemory
// ---------------------------------------------------------------------------

describe('searchChatMemory (U-CT-memory-*)', () => {
  it('U-CT-memory-01: finds relevant past messages', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.searchChatMemory, { query: 'beetles', limit: 4 });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]!.text).toMatch(/beetle/i);
  });

  it('U-CT-memory-02: returns empty array for no matches', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.searchChatMemory, { query: 'dragonfly quantum', limit: 4 });
    expect(result).toHaveLength(0);
  });

  it('U-CT-memory-03: respects limit', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.searchChatMemory, { query: 'beetle insect', limit: 1 });
    expect(result.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// getInsectInfo
// ---------------------------------------------------------------------------

describe('getInsectInfo (U-CT-insect-*)', () => {
  it('U-CT-insect-01: returns all bugs when no filter', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, {});
    expect(result).toHaveLength(BUGS.length);
  });

  it('U-CT-insect-02: filters by ID', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { ids: ['hcat', 'lady'] });
    expect(result).toHaveLength(2);
    expect(result.map((b: { id: string }) => b.id)).toEqual(expect.arrayContaining(['hcat', 'lady']));
  });

  it('U-CT-insect-03: filters by trait', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { trait: 'beetle' });
    expect(result.every((b: { traits: string[] }) => b.traits.includes('beetle'))).toBe(true);
  });

  it('U-CT-insect-04: filters by rarity', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { rarity: 'rare' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((b: { rarity: string }) => b.rarity === 'rare')).toBe(true);
  });

  it('U-CT-insect-05: filters by nameLike (case-insensitive)', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { nameLike: 'ladybird' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((b: { name: string }) => b.name.toLowerCase().includes('ladybird'))).toBe(true);
  });

  it('U-CT-insect-06: nameLike matches latin name', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { nameLike: 'apis' });
    expect(result.some((b: { latin: string }) => b.latin.toLowerCase().includes('apis'))).toBe(true);
  });

  it('U-CT-insect-07: marks caught species correctly', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { ids: ['hcat', 'stag'] });
    const hcat = result.find((b: { id: string }) => b.id === 'hcat');
    const stag = result.find((b: { id: string }) => b.id === 'stag');
    expect(hcat?.caught).toBe(true);
    expect(stag?.caught).toBe(false);
  });

  it('U-CT-insect-08: returns empty for unknown IDs', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getInsectInfo, { ids: ['nope', 'fake'] });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getUserSettings
// ---------------------------------------------------------------------------

describe('getUserSettings (U-CT-settings-*)', () => {
  it('U-CT-settings-01: returns all profile fields', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getUserSettings, {});
    expect(result.name).toBe('Tester');
    expect(result.networkOn).toBe(false);
    expect(result.language).toBe('en');
    expect(result.installedRegions).toContain('eu-ce');
  });
});

// ---------------------------------------------------------------------------
// updateUserSettings
// ---------------------------------------------------------------------------

describe('updateUserSettings (U-CT-update-*)', () => {
  it('U-CT-update-01: calls onUpdateSettings with the patch', async () => {
    const onUpdateSettings = vi.fn();
    const tools = buildChatTools(makeCtx({ onUpdateSettings }));
    const result = await execTool(tools.updateUserSettings, { networkOn: true });
    expect(onUpdateSettings).toHaveBeenCalledWith({ networkOn: true });
    expect(result.updated).toBe(true);
    expect(result.changes).toContain('networkOn');
  });

  it('U-CT-update-02: returns updated=false when no fields provided', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.updateUserSettings, {});
    expect(result.updated).toBe(false);
  });

  it('U-CT-update-03: does not throw when onUpdateSettings is undefined', async () => {
    const tools = buildChatTools(makeCtx({ onUpdateSettings: undefined }));
    await expect(
      execTool(tools.updateUserSettings, { localLlmOn: true }),
    ).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getUserStats
// ---------------------------------------------------------------------------

describe('getUserStats (U-CT-stats-*)', () => {
  it('U-CT-stats-01: returns xp, level, caughtSpecies, totalSpecies', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getUserStats, {});
    expect(result.xp).toBeGreaterThan(0);
    expect(result.level).toBeGreaterThanOrEqual(1);
    expect(result.caughtSpecies).toBe(4); // hcat, lady, buff, brim
    expect(result.totalSpecies).toBe(BUGS.length);
  });

  it('U-CT-stats-02: completionPct is rounded 0-100', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getUserStats, {});
    expect(result.completionPct).toBeGreaterThanOrEqual(0);
    expect(result.completionPct).toBeLessThanOrEqual(100);
    expect(Number.isInteger(result.completionPct)).toBe(true);
  });

  it('U-CT-stats-03: recentCatches sorted newest first', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getUserStats, {});
    const ats = result.recentCatches.map((c: { at: number }) => c.at);
    expect(ats).toEqual([...ats].sort((a, b) => b - a));
  });

  it('U-CT-stats-04: followedCount matches followed Set size', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getUserStats, {});
    expect(result.followedCount).toBe(2);
  });

  it('U-CT-stats-05: xp includes claimed quest rewards', async () => {
    const baseTools = buildChatTools(makeCtx({ questClaimedAt: {} }));
    const claimedTools = buildChatTools(makeCtx({ questClaimedAt: { q2: 1_700_000_000 } }));
    const base = await execTool(baseTools.getUserStats, {});
    const withClaim = await execTool(claimedTools.getUserStats, {});
    expect(withClaim.xp).toBeGreaterThan(base.xp);
  });
});

// ---------------------------------------------------------------------------
// getMapMarkers
// ---------------------------------------------------------------------------

describe('getMapMarkers (U-CT-markers-*)', () => {
  it('U-CT-markers-01: only returns catches with GPS coords', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getMapMarkers, { limit: 50 });
    // Only hcat has lat/lng in the seed data
    expect(result.count).toBe(1);
    expect(result.markers[0]!.bugId).toBe('hcat');
    expect(result.markers[0]!.lat).toBe(51.5);
  });

  it('U-CT-markers-02: respects limit', async () => {
    const ctx = makeCtx({
      catchLog: Array.from({ length: 10 }, (_, i) => ({
        id: 'hcat',
        at: i * 1000,
        lat: 51 + i * 0.01,
        lng: -0.1,
      })),
    });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getMapMarkers, { limit: 3 });
    expect(result.markers.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// getQuests
// ---------------------------------------------------------------------------

describe('getQuests (U-CT-quests-*)', () => {
  it('U-CT-quests-01: returns active quests with live progress', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getQuests, {});
    expect(result.active).toHaveLength(QUESTS.length);
    const q1 = result.active.find((q: { id: string }) => q.id === 'q1')!;
    expect(q1.progress).toBe(2);
    expect(q1.isComplete).toBe(false); // 2/3
    const q2 = result.active.find((q: { id: string }) => q.id === 'q2')!;
    expect(q2.isComplete).toBe(true); // 1/1
    expect(q2.isClaimed).toBe(true);
  });

  it('U-CT-quests-02: returns completed quest history', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getQuests, {});
    expect(result.completed).toHaveLength(COMPLETED_QUESTS.length);
  });
});

// ---------------------------------------------------------------------------
// getBugOfDay
// ---------------------------------------------------------------------------

describe('getBugOfDay (U-CT-bod-*)', () => {
  it('U-CT-bod-01: returns a bug with required fields', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getBugOfDay, {});
    expect(result.id).toBeTruthy();
    expect(result.name).toBeTruthy();
    expect(result.latin).toBeTruthy();
    expect(result.emoji).toBeTruthy();
    expect(['common', 'uncommon', 'rare', 'legendary']).toContain(result.rarity);
  });

  it('U-CT-bod-02: marks caught=true when bug is in dex, false otherwise', async () => {
    const toolsWithAll = buildChatTools(makeCtx({ dex: new Set(BUGS.map((b) => b.id)) }));
    const resultCaught = await execTool(toolsWithAll.getBugOfDay, {});
    expect(resultCaught.caught).toBe(true);

    const toolsEmpty = buildChatTools(makeCtx({ dex: new Set() }));
    const resultNotCaught = await execTool(toolsEmpty.getBugOfDay, {});
    expect(resultNotCaught.caught).toBe(false);
  });

  it('U-CT-bod-03: returns deterministic result (same call twice = same bug)', async () => {
    const tools = buildChatTools(makeCtx());
    const r1 = await execTool(tools.getBugOfDay, {});
    const r2 = await execTool(tools.getBugOfDay, {});
    expect(r1.id).toBe(r2.id);
  });
});

// ---------------------------------------------------------------------------
// getAvailableImages
// ---------------------------------------------------------------------------

describe('getAvailableImages (U-CT-images-*)', () => {
  it('U-CT-images-01: returns all bugs by default', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getAvailableImages, { caughtOnly: false });
    expect(result).toHaveLength(BUGS.length);
    expect(result[0]).toHaveProperty('emoji');
    expect(result[0]).toHaveProperty('color');
  });

  it('U-CT-images-02: caughtOnly filters to dex', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getAvailableImages, { caughtOnly: true });
    expect(result.length).toBe(4); // hcat, lady, buff, brim
    expect(result.every((b: { caught: boolean }) => b.caught)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getLeaderboard
// ---------------------------------------------------------------------------

describe('getLeaderboard (U-CT-leaderboard-*)', () => {
  it('U-CT-leaderboard-01: returns local data when network is off', async () => {
    const tools = buildChatTools(makeCtx({ profile: { name: 'T', networkOn: false, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false } }));
    const result = await execTool(tools.getLeaderboard, { scope: 'global' });
    expect(result.source).toBe('local');
    expect(result.entries.length).toBeGreaterThan(0);
  });

  it('U-CT-leaderboard-02: falls back to local when backend throws', async () => {
    const backend = {
      ready: () => true,
      identity: vi.fn(),
      fetchLeaderboard: vi.fn().mockRejectedValue(new Error('offline')),
      syncProfile: vi.fn(),
      publishCatch: vi.fn(),
      fetchFriends: vi.fn(),
      fetchFeed: vi.fn(),
      follow: vi.fn(),
      unfollow: vi.fn(),
    };
    const tools = buildChatTools(makeCtx({
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
      backend,
    }));
    const result = await execTool(tools.getLeaderboard, { scope: 'global' });
    expect(result.source).toBe('local');
  });

  it('U-CT-leaderboard-03: uses backend when ready and network is on', async () => {
    const fakeEntry = { userId: 'u1', displayName: 'Alice', xp: 9999, rank: 1, rankDelta: null };
    const backend = {
      ready: () => true,
      identity: vi.fn(),
      fetchLeaderboard: vi.fn().mockResolvedValue({
        scope: 'global',
        entries: [fakeEntry],
        selfRank: 6,
        totalCount: 1,
        fetchedAt: Date.now(),
        nextCursor: null,
      }),
      syncProfile: vi.fn(),
      publishCatch: vi.fn(),
      fetchFriends: vi.fn(),
      fetchFeed: vi.fn(),
      follow: vi.fn(),
      unfollow: vi.fn(),
    };
    const tools = buildChatTools(makeCtx({
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
      backend,
    }));
    const result = await execTool(tools.getLeaderboard, { scope: 'global' });
    expect(result.source).toBe('backend');
    expect(result.entries[0]).toMatchObject({ displayName: 'Alice' });
  });
});

// ---------------------------------------------------------------------------
// getFriendsList
// ---------------------------------------------------------------------------

describe('getFriendsList (U-CT-friends-*)', () => {
  it('U-CT-friends-01: returns local followed list when network off', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getFriendsList, { scope: 'following' });
    expect(result.source).toBe('local');
    expect(result.totalCount).toBe(2);
  });

  it('U-CT-friends-02: returns empty for followers scope without backend', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getFriendsList, { scope: 'followers' });
    expect(result.source).toBe('local');
    expect(result.entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getSocialFeed
// ---------------------------------------------------------------------------

describe('getSocialFeed (U-CT-feed-*)', () => {
  it('U-CT-feed-01: returns empty events with note when offline', async () => {
    const tools = buildChatTools(makeCtx());
    const result = await execTool(tools.getSocialFeed, {});
    expect(result.source).toBe('local');
    expect(result.events).toHaveLength(0);
  });

  it('U-CT-feed-02: uses backend when available and network on', async () => {
    const fakeEvent = { id: 'e1', kind: 'catch', at: Date.now(), actor: { userId: 'u1', displayName: 'Alice', rel: 'following' }, bugId: 'hcat' };
    const backend = {
      ready: () => true,
      fetchFeed: vi.fn().mockResolvedValue({ events: [fakeEvent], fetchedAt: Date.now(), nextCursor: null }),
      fetchLeaderboard: vi.fn(),
      fetchFriends: vi.fn(),
      syncProfile: vi.fn(),
      publishCatch: vi.fn(),
      follow: vi.fn(),
      unfollow: vi.fn(),
      identity: vi.fn(),
    };
    const tools = buildChatTools(makeCtx({
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
      backend,
    }));
    const result = await execTool(tools.getSocialFeed, {});
    expect(result.source).toBe('backend');
    expect(result.events).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// getInsectPhoto
// ---------------------------------------------------------------------------

describe('getInsectPhoto (U-CT-photo-*)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('U-CT-photo-01: returns local photo when catchLog has one for the bug', async () => {
    const ctx = makeCtx({
      catchLog: [
        { id: 'lady', at: 1_700_000_000_000, photoUri: 'file://photos/lady.jpg' },
        { id: 'hcat', at: 1_700_100_000_000, photoUri: 'file://photos/hcat.jpg' },
        // second, newer lady photo — should be preferred
        { id: 'lady', at: 1_700_200_000_000, photoUri: 'file://photos/lady2.jpg' },
      ],
    });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getInsectPhoto, { bugId: 'lady' });
    expect(result.uri).toBe('file://photos/lady2.jpg');
    expect(result.source).toBe('local');
  });

  it('U-CT-photo-02: falls back to iNaturalist when no local photo and network is on', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ default_photo: { medium_url: 'https://inaturalist.org/photos/bee.jpg' } }],
        }),
      }),
    );
    const ctx = makeCtx({
      catchLog: [], // no photos
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
    });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getInsectPhoto, { bugId: 'hcat' });
    expect(result.uri).toBe('https://inaturalist.org/photos/bee.jpg');
    expect(result.source).toBe('network');
  });

  it('U-CT-photo-03: returns null with offline message when network is off and no local photo', async () => {
    const ctx = makeCtx({ catchLog: [] });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getInsectPhoto, { bugId: 'hcat' });
    expect(result.uri).toBeNull();
    expect((result as { message: string }).message).toMatch(/network/i);
  });

  it('U-CT-photo-04: returns null gracefully when iNaturalist fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const ctx = makeCtx({
      catchLog: [],
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
    });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getInsectPhoto, { bugId: 'hcat' });
    expect(result.uri).toBeNull();
  });

  it('U-CT-photo-05: prefers local photo over network even when networkOn', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const ctx = makeCtx({
      catchLog: [{ id: 'hcat', at: 1_700_000_000_000, photoUri: 'file://mine.jpg' }],
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
    });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getInsectPhoto, { bugId: 'hcat' });
    expect(result.uri).toBe('file://mine.jpg');
    expect(result.source).toBe('local');
    // Should never hit the network when we have a local photo
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('U-CT-photo-06: returns null with "no photo available" when iNaturalist returns no results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] }),
      }),
    );
    const ctx = makeCtx({
      catchLog: [],
      profile: { name: 'T', networkOn: true, leaderboardOn: true, locationShareOn: false, crashReportingOn: false, localLlmOn: false },
    });
    const tools = buildChatTools(ctx);
    const result = await execTool(tools.getInsectPhoto, { bugId: 'hcat' });
    expect(result.uri).toBeNull();
  });
});

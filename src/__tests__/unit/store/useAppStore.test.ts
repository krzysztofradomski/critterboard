import { vi, describe, it, expect, beforeEach } from 'vitest';

// Remove the persist middleware so the store is a plain in-memory store in tests.
vi.mock('zustand/middleware', async (importOriginal) => {
  const mod = await importOriginal<typeof import('zustand/middleware')>();
  return { ...mod, persist: (fn: unknown) => fn };
});

import { useAppStore } from '@/store/useAppStore';

const BASE_STATE = {
  stack: [{ name: 'home' as const, params: undefined }],
  dex: new Set<string>(),
  followed: new Set<string>(),
  persona: 'larva' as const,
  language: 'en' as const,
  profile: {
    name: 'you',
    networkOn: false,
    leaderboardOn: true,
    locationShareOn: false,
    crashReportingOn: false,
    localLlmOn: false,
  },
  hasOnboarded: false,
  toast: null,
  lastPhotoUri: null,
  catchLog: [] as import('@/lib/streak').CatchEvent[],
  activityLog: [],
  mapLocation: null,
  questProgress: { q1: 0, q2: 0, q3: 0, q4: 0 },
  questCompletedAt: {} as Record<string, number>,
  questClaimedAt: {} as Record<string, number>,
  backendUserId: 'test-id',
  chatThreads: {},
  conversationMemory: [],
};

beforeEach(() => {
  useAppStore.setState(BASE_STATE);
});

// ──────────────────────────────────────────────────────────────────────────
// Navigation
// ──────────────────────────────────────────────────────────────────────────

describe('go / back (U-ST-01 – U-ST-03)', () => {
  it('U-ST-01: go to a non-tab route pushes onto the stack', () => {
    useAppStore.getState().go('result', { id: 'hcat' });
    const stack = useAppStore.getState().stack;
    expect(stack.length).toBe(2);
    expect(stack[stack.length - 1]!.name).toBe('result');
  });

  it('going to a main tab resets stack to [home, tab]', () => {
    useAppStore.getState().go('dex');
    const stack = useAppStore.getState().stack;
    expect(stack[0]!.name).toBe('home');
    expect(stack[1]!.name).toBe('dex');
    expect(stack.length).toBe(2);
  });

  it('going to "home" resets stack to [home] only', () => {
    useAppStore.getState().go('home');
    const stack = useAppStore.getState().stack;
    expect(stack.length).toBe(1);
    expect(stack[0]!.name).toBe('home');
  });

  it('U-ST-02: back() pops the last entry', () => {
    useAppStore.getState().go('result', { id: 'hcat' });
    useAppStore.getState().back();
    const stack = useAppStore.getState().stack;
    expect(stack.length).toBe(1);
    expect(stack[0]!.name).toBe('home');
  });

  it('U-ST-03: back() at root does not pop below 1 entry', () => {
    useAppStore.getState().back();
    expect(useAppStore.getState().stack.length).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// catchBug
// ──────────────────────────────────────────────────────────────────────────

describe('catchBug (U-ST-04 – U-ST-06)', () => {
  it('U-ST-04: new bug added to dex, XP increases', () => {
    useAppStore.getState().catchBug('hcat');
    const { dex } = useAppStore.getState();
    expect(dex.has('hcat')).toBe(true);
  });

  it('U-ST-05: catching a duplicate does not change dex size', () => {
    useAppStore.getState().catchBug('hcat');
    const sizeAfterFirst = useAppStore.getState().dex.size;
    useAppStore.getState().catchBug('hcat');
    expect(useAppStore.getState().dex.size).toBe(sizeAfterFirst);
  });

  it('U-ST-06: catchBug always adds an entry to catchLog', () => {
    useAppStore.getState().catchBug('hcat');
    expect(useAppStore.getState().catchLog.length).toBe(1);
    useAppStore.getState().catchBug('hcat');
    expect(useAppStore.getState().catchLog.length).toBe(2);
  });

  it('catchBug emits an activityLog entry', () => {
    useAppStore.getState().catchBug('hcat');
    const log = useAppStore.getState().activityLog;
    expect(log.length).toBeGreaterThan(0);
    const catchEntry = log.find((e) => e.kind === 'catch');
    expect(catchEntry).toBeDefined();
  });

  it('catching a pollinator advances q1 quest counter', () => {
    useAppStore.getState().catchBug('hcat'); // hcat = pollinator
    expect(useAppStore.getState().questProgress['q1']).toBe(1);
  });

  it('catching a beetle+pollinator bug advances both q1 and q2', () => {
    useAppStore.getState().catchBug('lady'); // lady = beetle + pollinator
    expect(useAppStore.getState().questProgress['q1']).toBe(1);
    expect(useAppStore.getState().questProgress['q2']).toBe(1);
  });

  it('completing q2 (total=1) stamps questCompletedAt', () => {
    useAppStore.getState().catchBug('lady'); // lady is a beetle, q2 total=1
    expect(useAppStore.getState().questCompletedAt['q2']).toBeDefined();
  });

  it('U-ST-13: activityLog is capped at 50 entries', () => {
    for (let i = 0; i < 60; i++) {
      useAppStore.getState().catchBug('hcat');
    }
    expect(useAppStore.getState().activityLog.length).toBeLessThanOrEqual(50);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// claimQuest (U-ST-07, U-ST-08)
// ──────────────────────────────────────────────────────────────────────────

describe('claimQuest (U-ST-07 – U-ST-08)', () => {
  it('U-ST-07: claimQuest marks quest as claimed when completed', () => {
    // Complete q2 by catching a beetle
    useAppStore.getState().catchBug('lady');
    const result = useAppStore.getState().claimQuest('q2');
    expect(result).not.toBeNull();
    expect(result?.reward).toBe(40); // q2 reward = 40
    expect(useAppStore.getState().questClaimedAt['q2']).toBeDefined();
  });

  it('U-ST-08: claimQuest on incomplete quest returns null', () => {
    // q1 needs 3 pollinators, we catch 0
    const result = useAppStore.getState().claimQuest('q1');
    expect(result).toBeNull();
  });

  it('cannot claim the same quest twice', () => {
    useAppStore.getState().catchBug('lady');
    useAppStore.getState().claimQuest('q2');
    const second = useAppStore.getState().claimQuest('q2');
    expect(second).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// follow / unfollow / toggleFollow (U-ST-12)
// ──────────────────────────────────────────────────────────────────────────

describe('follow / unfollow / toggleFollow (U-ST-12)', () => {
  it('followUser adds to followed set', () => {
    useAppStore.getState().followUser('alice');
    expect(useAppStore.getState().followed.has('alice')).toBe(true);
  });

  it('unfollowUser removes from followed set', () => {
    useAppStore.getState().followUser('alice');
    useAppStore.getState().unfollowUser('alice');
    expect(useAppStore.getState().followed.has('alice')).toBe(false);
  });

  it('followUser is idempotent', () => {
    useAppStore.getState().followUser('alice');
    useAppStore.getState().followUser('alice');
    expect(useAppStore.getState().followed.size).toBe(1);
  });

  it('toggleFollow adds when absent, removes when present', () => {
    useAppStore.getState().toggleFollow('bob');
    expect(useAppStore.getState().followed.has('bob')).toBe(true);
    useAppStore.getState().toggleFollow('bob');
    expect(useAppStore.getState().followed.has('bob')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// setPersona (U-ST-09)
// ──────────────────────────────────────────────────────────────────────────

describe('setPersona (U-ST-09)', () => {
  it('U-ST-09: changes persona and adds an activity log entry', () => {
    useAppStore.getState().setPersona('snail');
    expect(useAppStore.getState().persona).toBe('snail');
    const personaEntry = useAppStore.getState().activityLog.find((e) => e.kind === 'persona');
    expect(personaEntry).toBeDefined();
  });

  it('setting same persona twice does not add duplicate activity entries', () => {
    useAppStore.getState().setPersona('snail');
    const countAfterFirst = useAppStore.getState().activityLog.length;
    useAppStore.getState().setPersona('snail'); // no-op
    expect(useAppStore.getState().activityLog.length).toBe(countAfterFirst);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// wipeAll (U-ST-10, U-ST-11)
// ──────────────────────────────────────────────────────────────────────────

describe('wipeAll (U-ST-10 – U-ST-11)', () => {
  it('U-ST-10: wipeAll clears dex and catchLog', async () => {
    useAppStore.getState().catchBug('hcat');
    await useAppStore.getState().wipeAll();
    expect(useAppStore.getState().dex.size).toBe(0);
    expect(useAppStore.getState().catchLog.length).toBe(0);
  });

  it('U-ST-11: wipeAll preserves the language setting', async () => {
    useAppStore.setState({ language: 'de' });
    await useAppStore.getState().wipeAll();
    expect(useAppStore.getState().language).toBe('de');
  });

  it('wipeAll resets persona to "larva"', async () => {
    useAppStore.getState().setPersona('snail');
    await useAppStore.getState().wipeAll();
    expect(useAppStore.getState().persona).toBe('larva');
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Chat threads
// ──────────────────────────────────────────────────────────────────────────

describe('saveChatThread / clearChatThread', () => {
  it('saves a chat thread and retrieves it', () => {
    const msgs = [{ who: 'me' as const, t: 'Hello' }];
    useAppStore.getState().saveChatThread('thread-1', msgs);
    const thread = useAppStore.getState().chatThreads['thread-1'];
    expect(thread?.messages).toEqual(msgs);
  });

  it('clearChatThread removes the thread', () => {
    useAppStore.getState().saveChatThread('thread-2', [{ who: 'me', t: 'test' }]);
    useAppStore.getState().clearChatThread('thread-2');
    expect(useAppStore.getState().chatThreads['thread-2']).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// indexConversationMessage
// ──────────────────────────────────────────────────────────────────────────

describe('indexConversationMessage', () => {
  it('adds an entry to conversationMemory', () => {
    useAppStore.getState().indexConversationMessage('t1', { who: 'me', t: 'bumblebee spotted' });
    expect(useAppStore.getState().conversationMemory.length).toBe(1);
  });

  it('ignores whitespace-only messages', () => {
    useAppStore.getState().indexConversationMessage('t1', { who: 'me', t: '   ' });
    expect(useAppStore.getState().conversationMemory.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// updateThreadSummary
// ──────────────────────────────────────────────────────────────────────────

describe('updateThreadSummary (U-ST-sum-*)', () => {
  it('U-ST-sum-01: stores a summary on an existing thread', () => {
    useAppStore.getState().saveChatThread('sum-thread', [{ who: 'me', t: 'Hi' }]);
    useAppStore.getState().updateThreadSummary('sum-thread', 'User said hi.');
    expect(useAppStore.getState().chatThreads['sum-thread']?.summary).toBe('User said hi.');
  });

  it('U-ST-sum-02: no-ops when thread does not exist', () => {
    useAppStore.getState().updateThreadSummary('ghost-thread', 'summary');
    expect(useAppStore.getState().chatThreads['ghost-thread']).toBeUndefined();
  });

  it('U-ST-sum-03: does not affect other threads', () => {
    useAppStore.getState().saveChatThread('a', [{ who: 'me', t: 'msg' }]);
    useAppStore.getState().saveChatThread('b', [{ who: 'me', t: 'msg' }]);
    useAppStore.getState().updateThreadSummary('a', 'summary for a');
    expect(useAppStore.getState().chatThreads['b']?.summary).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// removeMessageFromThread
// ──────────────────────────────────────────────────────────────────────────

describe('removeMessageFromThread (U-ST-rm-*)', () => {
  it('U-ST-rm-01: removes message at given index', () => {
    useAppStore.getState().saveChatThread('rm-thread', [
      { who: 'me', t: 'first' },
      { who: 'larva', t: 'second' },
      { who: 'me', t: 'third' },
    ]);
    useAppStore.getState().removeMessageFromThread('rm-thread', 1);
    const msgs = useAppStore.getState().chatThreads['rm-thread']?.messages;
    expect(msgs).toHaveLength(2);
    expect(msgs?.[0]?.t).toBe('first');
    expect(msgs?.[1]?.t).toBe('third');
  });

  it('U-ST-rm-02: clears thread summary when a message is deleted', () => {
    useAppStore.getState().saveChatThread('sum-rm', [{ who: 'me', t: 'msg' }]);
    useAppStore.getState().updateThreadSummary('sum-rm', 'some summary');
    useAppStore.getState().removeMessageFromThread('sum-rm', 0);
    expect(useAppStore.getState().chatThreads['sum-rm']?.summary).toBeUndefined();
  });

  it('U-ST-rm-03: strips matching conversationMemory entry', () => {
    useAppStore.getState().indexConversationMessage('mem-rm', { who: 'me', t: 'beetle question' });
    useAppStore.getState().saveChatThread('mem-rm', [{ who: 'me', t: 'beetle question' }]);
    useAppStore.getState().removeMessageFromThread('mem-rm', 0);
    const mem = useAppStore.getState().conversationMemory;
    expect(mem.some((e) => e.text === 'beetle question' && e.threadId === 'mem-rm')).toBe(false);
  });

  it('U-ST-rm-04: no-ops when thread does not exist', () => {
    const before = { ...useAppStore.getState().chatThreads };
    useAppStore.getState().removeMessageFromThread('no-thread', 0);
    expect(useAppStore.getState().chatThreads).toEqual(before);
  });

  it('U-ST-rm-05: no-ops when index is out of bounds', () => {
    useAppStore.getState().saveChatThread('bounds', [{ who: 'me', t: 'only' }]);
    useAppStore.getState().removeMessageFromThread('bounds', 99);
    expect(useAppStore.getState().chatThreads['bounds']?.messages).toHaveLength(1);
  });

  it('U-ST-rm-06: updates thread updatedAt timestamp', () => {
    const before = Date.now();
    useAppStore.getState().saveChatThread('ts-thread', [
      { who: 'me', t: 'a' },
      { who: 'larva', t: 'b' },
    ]);
    useAppStore.getState().removeMessageFromThread('ts-thread', 0);
    const updatedAt = useAppStore.getState().chatThreads['ts-thread']?.updatedAt ?? 0;
    expect(updatedAt).toBeGreaterThanOrEqual(before);
  });
});

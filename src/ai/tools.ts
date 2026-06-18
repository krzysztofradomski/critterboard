import { tool } from 'ai';
import { z } from 'zod';

import type { BackendAdapter } from '@/backend/adapter';
import type { Profile, ChatThread } from '@/store/useAppStore';
import type { CatchEvent } from '@/lib/streak';
import type { ConversationMemoryEntry } from '@/lib/conversationMemory';

import { BUGS, findBug } from '@/data/bugs';
import { QUESTS, COMPLETED_QUESTS } from '@/data/quests';
import { LEADERS } from '@/data/leaderboard';
import { bugOfDay } from '@/lib/bugOfDay';
import { xpFromDex, xpFromClaimedQuests, levelFromXp } from '@/lib/level';
import { currentStreak, latestPhotoFor } from '@/lib/streak';
import { searchConversationMemories } from '@/lib/conversationMemory';

// ---------------------------------------------------------------------------
// Context passed into every tool at call time (built from live store state)
// ---------------------------------------------------------------------------

export type ToolContext = {
  profile: Profile;
  dex: ReadonlySet<string>;
  catchLog: readonly CatchEvent[];
  questProgress: Readonly<Record<string, number>>;
  questCompletedAt: Readonly<Record<string, number>>;
  questClaimedAt: Readonly<Record<string, number>>;
  chatThreads: Readonly<Record<string, ChatThread>>;
  conversationMemory: readonly ConversationMemoryEntry[];
  followed: ReadonlySet<string>;
  language: string;
  installedRegions: readonly string[];
  /** Called when the user asks to change a setting via chat. */
  onUpdateSettings?: (patch: Partial<Profile>) => void;
  /** Optional: wired backend adapter for live social data. */
  backend?: BackendAdapter;
};

// ---------------------------------------------------------------------------
// Tool factory — call once per streamReply invocation with the live context
// ---------------------------------------------------------------------------

export function buildChatTools(ctx: ToolContext) {
  return {
    getChatHistory: tool({
      description:
        'Retrieve saved messages from a specific chat thread by its threadId. Thread IDs have the form "personaId::topic", e.g. "larva::general" or "snail::beetles".',
      inputSchema: z.object({
        threadId: z.string().describe('Thread key like "larva::general"'),
      }),
      execute: async ({ threadId }) => {
        const thread = ctx.chatThreads[threadId];
        if (!thread) return { found: false, messages: [] as Array<{ who: string; t: string }> };
        return { found: true, messages: thread.messages, updatedAt: thread.updatedAt };
      },
    }),

    searchChatMemory: tool({
      description:
        'Full-text search across all past conversation messages from every thread. Use this to retrieve relevant context from earlier conversations before answering.',
      inputSchema: z.object({
        query: z.string().describe('Natural-language query'),
        limit: z.number().int().min(1).max(10).default(4).describe('Max results'),
      }),
      execute: async ({ query, limit }) => {
        const hits = searchConversationMemories(
          ctx.conversationMemory as ConversationMemoryEntry[],
          query,
          limit,
        );
        return hits.map((h) => ({
          text: h.entry.text,
          who: h.entry.who,
          threadId: h.entry.threadId,
          score: h.score,
          createdAt: h.entry.createdAt,
        }));
      },
    }),

    getInsectInfo: tool({
      description:
        'Look up detailed information about insects in the app database. Supports filtering by ID, trait, rarity tier, or partial name. Returns caught status for each match.',
      inputSchema: z.object({
        ids: z.array(z.string()).optional().describe('Specific bug IDs e.g. ["hcat","lady"]'),
        trait: z
          .enum(['pollinator', 'beetle', 'butterfly', 'wasp', 'damselfly', 'bug'])
          .optional()
          .describe('Filter by trait'),
        rarity: z
          .enum(['common', 'uncommon', 'rare', 'legendary'])
          .optional()
          .describe('Filter by rarity tier'),
        nameLike: z
          .string()
          .optional()
          .describe('Partial name or latin name match (case-insensitive)'),
      }),
      execute: async ({ ids, trait, rarity, nameLike }) => {
        let bugs = BUGS;
        if (ids?.length) bugs = bugs.filter((b) => ids.includes(b.id));
        if (trait) bugs = bugs.filter((b) => (b.traits as string[]).includes(trait));
        if (rarity) bugs = bugs.filter((b) => b.rarity === rarity);
        if (nameLike) {
          const lower = nameLike.toLowerCase();
          bugs = bugs.filter(
            (b) =>
              b.name.toLowerCase().includes(lower) || b.latin.toLowerCase().includes(lower),
          );
        }
        return bugs.map((b) => ({
          id: b.id,
          name: b.name,
          latin: b.latin,
          rarity: b.rarity,
          xp: b.xp,
          tier: b.tier,
          emoji: b.emoji,
          color: b.color,
          traits: b.traits,
          caught: ctx.dex.has(b.id),
        }));
      },
    }),

    getUserSettings: tool({
      description: 'Get the current user profile and all app settings.',
      inputSchema: z.object({}),
      execute: async () => ({
        name: ctx.profile.name,
        networkOn: ctx.profile.networkOn,
        leaderboardOn: ctx.profile.leaderboardOn,
        locationShareOn: ctx.profile.locationShareOn,
        crashReportingOn: ctx.profile.crashReportingOn,
        localLlmOn: ctx.profile.localLlmOn,
        language: ctx.language,
        installedRegions: Array.from(ctx.installedRegions),
      }),
    }),

    updateUserSettings: tool({
      description:
        'Update one or more user profile settings. Only include fields the user explicitly asked to change.',
      inputSchema: z.object({
        name: z.string().min(1).max(30).optional().describe('Display name'),
        networkOn: z.boolean().optional().describe('Enable/disable network features'),
        leaderboardOn: z.boolean().optional().describe('Show/hide from leaderboard'),
        locationShareOn: z.boolean().optional().describe('Enable/disable location sharing'),
        crashReportingOn: z.boolean().optional().describe('Enable/disable crash reporting'),
        localLlmOn: z
          .boolean()
          .optional()
          .describe('Use on-device LLM instead of cloud Gemini'),
      }),
      execute: async (patch) => {
        const keys = (Object.keys(patch) as Array<keyof typeof patch>).filter(
          (k) => patch[k] !== undefined,
        );
        if (keys.length === 0) return { updated: false, reason: 'no fields provided' };
        ctx.onUpdateSettings?.(patch);
        return { updated: true, changes: keys };
      },
    }),

    getUserStats: tool({
      description:
        'Get user XP, level, streak, dex completion percentage, and recent catches with progression details.',
      inputSchema: z.object({}),
      execute: async () => {
        const xp = xpFromDex(ctx.dex) + xpFromClaimedQuests(ctx.questClaimedAt);
        const levelInfo = levelFromXp(xp);
        const streak = currentStreak(ctx.catchLog as CatchEvent[]);
        const totalSpecies = BUGS.length;
        const caughtSpecies = ctx.dex.size;
        const recentCatches = [...ctx.catchLog]
          .sort((a, b) => b.at - a.at)
          .slice(0, 10)
          .map((e) => {
            const bug = findBug(e.id);
            return {
              bugId: e.id,
              bugName: bug?.name ?? e.id,
              emoji: bug?.emoji,
              at: e.at,
              hasPhoto: Boolean(e.photoUri),
              hasCoords: e.lat !== undefined,
            };
          });
        return {
          xp,
          level: levelInfo.level,
          into: levelInfo.into,
          span: levelInfo.span,
          nextAt: levelInfo.nextAt,
          streak,
          caughtSpecies,
          totalSpecies,
          completionPct: Math.round((100 * caughtSpecies) / totalSpecies),
          recentCatches,
          followedCount: ctx.followed.size,
        };
      },
    }),

    getMapMarkers: tool({
      description:
        "Get the user's catch events that have GPS coordinates — these are the pins shown on the map screen.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(50).describe('Max markers to return'),
      }),
      execute: async ({ limit }) => {
        const withCoords = [...ctx.catchLog]
          .filter((e) => e.lat !== undefined && e.lng !== undefined)
          .slice(-limit)
          .map((e) => {
            const bug = findBug(e.id);
            return {
              bugId: e.id,
              bugName: bug?.name ?? e.id,
              emoji: bug?.emoji,
              lat: e.lat!,
              lng: e.lng!,
              at: e.at,
              hasPhoto: Boolean(e.photoUri),
            };
          });
        return { count: withCoords.length, markers: withCoords };
      },
    }),

    getQuests: tool({
      description:
        'Get all quest state — active quests with live progress, and the completed quest history.',
      inputSchema: z.object({}),
      execute: async () => {
        const active = QUESTS.map((q) => ({
          id: q.id,
          kind: q.kind,
          reward: q.reward,
          total: q.total,
          progress: ctx.questProgress[q.id] ?? 0,
          completedAt: ctx.questCompletedAt[q.id] ?? null,
          claimedAt: ctx.questClaimedAt[q.id] ?? null,
          isComplete: (ctx.questProgress[q.id] ?? 0) >= q.total,
          isClaimed: ctx.questClaimedAt[q.id] !== undefined,
        }));
        const completed = COMPLETED_QUESTS.map((c) => ({
          id: c.id,
          kind: c.kind,
          reward: c.reward,
          icon: c.icon,
          claimedAt: ctx.questClaimedAt[c.id] ?? null,
        }));
        return { active, completed };
      },
    }),

    getBugOfDay: tool({
      description: "Get today's featured hero bug.",
      inputSchema: z.object({}),
      execute: async () => {
        const bug = bugOfDay();
        return {
          id: bug.id,
          name: bug.name,
          latin: bug.latin,
          rarity: bug.rarity,
          xp: bug.xp,
          emoji: bug.emoji,
          color: bug.color,
          traits: bug.traits,
          caught: ctx.dex.has(bug.id),
        };
      },
    }),

    getAvailableImages: tool({
      description:
        'List insects that have visual/image data in the app (emoji + color swatch). Use when discussing appearance or showing the visual catalogue.',
      inputSchema: z.object({
        caughtOnly: z
          .boolean()
          .default(false)
          .describe('When true, only return insects the user has already caught'),
      }),
      execute: async ({ caughtOnly }) => {
        const bugs = caughtOnly ? BUGS.filter((b) => ctx.dex.has(b.id)) : BUGS;
        return bugs.map((b) => ({
          id: b.id,
          name: b.name,
          emoji: b.emoji,
          color: b.color,
          caught: ctx.dex.has(b.id),
        }));
      },
    }),

    getLeaderboard: tool({
      description:
        'Get leaderboard rankings. Uses the live backend when network is on, otherwise falls back to local seed data.',
      inputSchema: z.object({
        scope: z
          .enum(['global', 'weekly', 'friends'])
          .default('global')
          .describe('Which leaderboard to fetch'),
      }),
      execute: async ({ scope }) => {
        if (ctx.backend?.ready() && ctx.profile.networkOn) {
          try {
            const page = await ctx.backend.fetchLeaderboard(scope);
            return {
              source: 'backend' as const,
              scope: page.scope,
              entries: page.entries.slice(0, 15),
              totalCount: page.totalCount,
              selfRank: page.selfRank,
            };
          } catch {
            // fall through to local data
          }
        }
        const xp = xpFromDex(ctx.dex) + xpFromClaimedQuests(ctx.questClaimedAt);
        return {
          source: 'local' as const,
          scope,
          entries: LEADERS.map((r) => ({
            rank: r.rank,
            name: r.name,
            xp: r.xp,
            badge: r.badge,
            country: r.country,
            isSelf: r.self ?? false,
          })),
          userXp: xp,
          note: ctx.profile.networkOn
            ? undefined
            : 'Enable network in settings to see live rankings.',
        };
      },
    }),

    getFriendsList: tool({
      description:
        'Get the following/followers/suggested friends list. Uses the live backend when network is on.',
      inputSchema: z.object({
        scope: z
          .enum(['following', 'followers', 'suggested'])
          .default('following')
          .describe('Which friend list to fetch'),
      }),
      execute: async ({ scope }) => {
        if (ctx.backend?.ready() && ctx.profile.networkOn) {
          try {
            const page = await ctx.backend.fetchFriends(scope);
            return {
              source: 'backend' as const,
              entries: page.entries,
              totalCount: page.totalCount,
            };
          } catch {
            // fall through
          }
        }
        if (scope === 'following') {
          return {
            source: 'local' as const,
            entries: Array.from(ctx.followed).map((name) => ({ displayName: name })),
            totalCount: ctx.followed.size,
          };
        }
        return {
          source: 'local' as const,
          entries: [] as Array<{ displayName: string }>,
          totalCount: 0,
          note: ctx.profile.networkOn
            ? undefined
            : 'Enable network in settings for full social features.',
        };
      },
    }),

    getSocialFeed: tool({
      description:
        'Get the social activity feed — recent events from other trainers. Requires network to be on.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.backend?.ready() && ctx.profile.networkOn) {
          try {
            const page = await ctx.backend.fetchFeed();
            return { source: 'backend' as const, events: page.events.slice(0, 20) };
          } catch {
            // fall through
          }
        }
        return {
          source: 'local' as const,
          events: [] as unknown[],
          note: 'Enable network in settings to see social activity from other trainers.',
        };
      },
    }),

    getInsectPhoto: tool({
      description:
        "Get a photo of a specific insect. Returns the user's own most-recent catch photo first. If the user has no photo for that bug and network is enabled, fetches a reference photo from iNaturalist. When a photo URI is returned, embed it in your reply as [IMAGE:uri] on its own line.",
      inputSchema: z.object({
        bugId: z.string().describe('Bug ID e.g. "hcat", "lady"'),
      }),
      execute: async ({ bugId }) => {
        const localUri = latestPhotoFor(ctx.catchLog as CatchEvent[], bugId);
        if (localUri) return { uri: localUri, source: 'local' as const };

        const bug = findBug(bugId);

        if (ctx.profile.networkOn && bug?.latin) {
          try {
            const resp = await fetch(
              `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(bug.latin)}&per_page=1`,
            );
            if (resp.ok) {
              const data = (await resp.json()) as {
                results?: Array<{ default_photo?: { medium_url?: string } }>;
              };
              const photoUrl = data.results?.[0]?.default_photo?.medium_url;
              if (photoUrl) return { uri: photoUrl, source: 'network' as const };
            }
          } catch {
            // fall through
          }
        }

        return {
          uri: null as null,
          message: ctx.profile.networkOn
            ? `No photo available for ${bug?.name ?? bugId}.`
            : `No personal photo for ${bug?.name ?? bugId}. Enable network in Settings to search online.`,
        };
      },
    }),
  };
}

export type ChatTools = ReturnType<typeof buildChatTools>;

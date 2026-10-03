import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cloudflareAdapter, resetBackendSession } from '@/backend/cloudflare';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

describe('cloudflare adapter', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_BACKEND_URL = 'https://api.test';
    resetBackendSession();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('screens loading together share one login instead of each spending a rate-limited /v1/auth', async () => {
    const fetchMock = vi.fn(async (url: string) => (url.endsWith('/v1/auth') ? ok({ token: 't' }) : ok({ id: 'u' })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await Promise.all([cloudflareAdapter.identity(), cloudflareAdapter.identity(), cloudflareAdapter.identity()]);
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/v1/auth'))).toHaveLength(1);
  });

  it('gives up on a request that never answers, as offline', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        // Hangs forever unless the caller aborts it.
        new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('aborted')))),
    ) as unknown as typeof fetch;
    const call = cloudflareAdapter.identity();
    const settled = expect(call).rejects.toMatchObject({ kind: 'offline' });
    await vi.advanceTimersByTimeAsync(15_000);
    await settled;
  });
});

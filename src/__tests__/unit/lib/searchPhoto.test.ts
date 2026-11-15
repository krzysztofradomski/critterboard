import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as FileSystem from 'expo-file-system/legacy';
import { fetch } from 'expo/fetch';
import { Linking } from 'react-native';
import { prepareSearchPhoto } from '@/lib/prepareSearchPhoto';
import { searchPhoto } from '@/lib/searchPhoto';

vi.mock('expo/fetch', () => ({ fetch: vi.fn() }));
vi.mock('react-native', () => ({ Linking: { openURL: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('expo-file-system', () => ({ File: class { constructor(public uri: string) {} } }));
vi.mock('@/lib/prepareSearchPhoto', () => ({ prepareSearchPhoto: vi.fn() }));

const results = 'https://www.google.com/search?vsrid=test-result';
const cancel = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, isDirectory: false, uri: 'file:///photo.jpg', size: 10, modificationTime: 0 });
  vi.mocked(prepareSearchPhoto).mockResolvedValue({ uri: 'file:///prepared.jpg', width: 1200, height: 1600, base64: 'jpeg-base64' });
  vi.mocked(fetch).mockResolvedValue({ status: 303, headers: new Headers({ location: results }), body: { cancel } } as unknown as Awaited<ReturnType<typeof fetch>>);
});

describe('direct visual search', () => {
  it('sends the prepared photo to Lens and opens its actual results, then deletes only the temporary copy', async () => {
    const append = vi.spyOn(FormData.prototype, 'append').mockImplementation(() => {});
    expect(await searchPhoto('file:///photo.jpg', 'google', 'pl')).toBe('opened');
    expect(prepareSearchPhoto).toHaveBeenCalledWith('file:///photo.jpg', false);
    expect(append).toHaveBeenCalledWith('encoded_image', expect.objectContaining({ uri: 'file:///prepared.jpg' }));
    expect(fetch).toHaveBeenCalledWith('https://lens.google.com/v3/upload?hl=pl', expect.objectContaining({ method: 'POST', redirect: 'manual', credentials: 'omit' }));
    expect(Linking.openURL).toHaveBeenCalledWith(results);
    expect(FileSystem.deleteAsync).toHaveBeenCalledExactlyOnceWith('file:///prepared.jpg', { idempotent: true });
    append.mockRestore();
  });

  it('sends Bing raw base64 as multipart and resolves its relative results URL', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ status: 302, headers: new Headers({ location: '/images/search?view=detailV2&insightsToken=test' }), body: { cancel } } as unknown as Awaited<ReturnType<typeof fetch>>);
    expect(await searchPhoto('file:///photo.jpg', 'bing', 'en')).toBe('opened');
    expect(prepareSearchPhoto).toHaveBeenCalledWith('file:///photo.jpg', true);
    const form = vi.mocked(fetch).mock.calls[0]![1]!.body as FormData;
    expect(form.get('imageBin')).toBe('jpeg-base64');
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.bing.com/images/search?view=detailV2&insightsToken=test');
  });

  it('does not upload a deleted photo', async () => {
    vi.mocked(FileSystem.getInfoAsync).mockResolvedValueOnce({ exists: false, isDirectory: false, uri: 'file:///gone.jpg' });
    expect(await searchPhoto('file:///gone.jpg', 'google', 'en')).toBe('missing');
    expect(prepareSearchPhoto).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not open unrelated redirects or retry with another provider', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ status: 303, headers: new Headers({ location: 'https://other.example/search?vsrid=x' }), body: { cancel } } as unknown as Awaited<ReturnType<typeof fetch>>);
    const append = vi.spyOn(FormData.prototype, 'append').mockImplementation(() => {});
    expect(await searchPhoto('file:///photo.jpg', 'google', 'en')).toBe('error');
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledOnce();
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
    append.mockRestore();
  });

  it('cleans up after a network failure and never opens a homepage fallback', async () => {
    const append = vi.spyOn(FormData.prototype, 'append').mockImplementation(() => {});
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    expect(await searchPhoto('file:///photo.jpg', 'google', 'en')).toBe('error');
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(FileSystem.deleteAsync).toHaveBeenCalledExactlyOnceWith('file:///prepared.jpg', { idempotent: true });
    append.mockRestore();
  });

  it('distinguishes a browser failure after the photo was sent', async () => {
    vi.mocked(Linking.openURL).mockRejectedValueOnce(new Error('no browser'));
    const append = vi.spyOn(FormData.prototype, 'append').mockImplementation(() => {});
    expect(await searchPhoto('file:///photo.jpg', 'google', 'en')).toBe('openError');
    expect(FileSystem.deleteAsync).toHaveBeenCalled();
    append.mockRestore();
  });
});

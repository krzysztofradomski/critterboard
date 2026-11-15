import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareSearchPhoto } from '@/lib/prepareSearchPhoto.web';
const image = { width: 3000, height: 4000, close: vi.fn() };
const drawImage = vi.fn();
const canvas = { width: 0, height: 0, getContext: vi.fn(() => ({ drawImage })), toDataURL: vi.fn(() => 'data:image/jpeg;base64,prepared-jpeg') };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['photo']) }));
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(image));
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
});
afterEach(() => vi.unstubAllGlobals());
describe('web photo preparation', () => {
  it('re-encodes a resized copy locally and closes the decoded bitmap without creating intermediate object URLs', async () => {
    expect(await prepareSearchPhoto('blob:catch', true)).toEqual({ uri: 'data:image/jpeg;base64,prepared-jpeg', width: 1200, height: 1600, base64: 'prepared-jpeg' });
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1200, 1600);
    expect(image.close).toHaveBeenCalledOnce();
  });
  it('does not retrieve a remote image URL', async () => {
    await expect(prepareSearchPhoto('https://example.com/photo', false)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});

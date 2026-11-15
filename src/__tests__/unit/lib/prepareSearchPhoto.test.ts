import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageManipulator } from 'expo-image-manipulator';
import { prepareSearchPhoto } from '@/lib/prepareSearchPhoto';
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: vi.fn() }, SaveFormat: { JPEG: 'jpeg' } }));

const image = { width: 4000, height: 3000, release: vi.fn() };
const output = { saveAsync: vi.fn().mockResolvedValue({ uri: 'file:///jpeg.jpg' }), release: vi.fn() };
const source = { renderAsync: vi.fn().mockResolvedValue(image), release: vi.fn() };
const context = { renderAsync: vi.fn().mockResolvedValue(output), resize: vi.fn(), release: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ImageManipulator.manipulate).mockReturnValueOnce(source as never).mockReturnValueOnce(context as never);
});

describe('photo preparation', () => {
  it('bounds the long edge, re-encodes as JPEG and releases native resources', async () => {
    await prepareSearchPhoto('file:///original.jpg', true);
    expect(context.resize).toHaveBeenCalledWith({ width: 1600, height: 1200 });
    expect(output.saveAsync).toHaveBeenCalledWith({ compress: 0.85, format: 'jpeg', base64: true });
    for (const resource of [source, image, context, output]) expect(resource.release).toHaveBeenCalledOnce();
  });
  it('releases image resources even if re-encoding fails', async () => {
    output.saveAsync.mockRejectedValueOnce(new Error('disk full'));
    await expect(prepareSearchPhoto('file:///original.jpg', false)).rejects.toThrow('disk full');
    for (const resource of [source, image, context, output]) expect(resource.release).toHaveBeenCalledOnce();
  });
});

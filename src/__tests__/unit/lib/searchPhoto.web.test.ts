import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareSearchPhoto } from '@/lib/prepareSearchPhoto';
import { searchPhoto } from '@/lib/searchPhoto.web';

vi.mock('@/lib/prepareSearchPhoto', () => ({ prepareSearchPhoto: vi.fn() }));

const results = { opener: {}, closed: false, close: vi.fn(), document: {} };
const makeForm = () => ({ action: '', method: '', enctype: '', target: '', hidden: false, appendChild: vi.fn(), submit: vi.fn(), remove: vi.fn() });
let form = makeForm();
const inputs: Array<Record<string, unknown>> = [];

beforeEach(() => {
  vi.clearAllMocks();
  form = makeForm();
  inputs.length = 0;
  results.closed = false;
  vi.stubGlobal('window', { open: vi.fn().mockReturnValue(results) });
  vi.stubGlobal('document', {
    createElement: (kind: string) => {
      if (kind === 'form') return form;
      const input = {};
      inputs.push(input);
      return input;
    },
    body: { appendChild: vi.fn() },
    head: { appendChild: vi.fn() },
  });
  results.document = document;
  vi.stubGlobal('DataTransfer', class { items = { add: vi.fn() }; files = ['prepared-file']; });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['jpeg'], { type: 'image/jpeg' }) }));
  vi.mocked(prepareSearchPhoto).mockResolvedValue({ uri: 'blob:prepared', width: 100, height: 100, base64: 'jpeg-base64' });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('browser photo search', () => {
  it('submits a prepared file directly to Lens without a manual picker or CORS upload', async () => {
    expect(await searchPhoto('blob:catch', 'google', 'de')).toBe('opened');
    expect(form.action).toBe('https://lens.google.com/upload?hl=de');
    expect(form.method).toBe('POST');
    expect(form.enctype).toBe('multipart/form-data');
    expect(form.target).toBe('_self');
    expect(inputs.find(i => i.name === 'encoded_image')).toEqual({ type: 'file', name: 'encoded_image', files: ['prepared-file'] });
    expect(form.submit).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledExactlyOnceWith('blob:prepared');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prepared');
    expect(results.opener).toBeNull();
  });

  it('submits the actual base64 image to Bing as multipart', async () => {
    expect(await searchPhoto('blob:catch', 'bing', 'en')).toBe('opened');
    expect(form.action).toBe('https://www.bing.com/images/detail/search?iss=sbiupload&FORM=CHROMI');
    expect(inputs.find(i => i.name === 'imageBin')).toEqual({ type: 'hidden', name: 'imageBin', value: 'jpeg-base64' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not prepare or upload when a popup is blocked', async () => {
    vi.mocked(window.open).mockReturnValueOnce(null);
    expect(await searchPhoto('blob:catch', 'google', 'en')).toBe('blocked');
    expect(prepareSearchPhoto).not.toHaveBeenCalled();
    expect(form.submit).not.toHaveBeenCalled();
  });

  it('does not fetch a remote photo URL', async () => {
    expect(await searchPhoto('https://example.com/private.jpg', 'google', 'en')).toBe('missing');
    expect(fetch).not.toHaveBeenCalled();
    expect(results.close).toHaveBeenCalled();
  });

  it('closes the reserved tab if preparing the photo fails', async () => {
    vi.mocked(prepareSearchPhoto).mockRejectedValueOnce(new Error('photo gone'));
    expect(await searchPhoto('blob:expired', 'google', 'en')).toBe('error');
    expect(results.close).toHaveBeenCalled();
    expect(form.submit).not.toHaveBeenCalled();
  });
});

import { imageSearchUploadUrl, type ImageSearchProvider, type ImageSearchResult } from '@/lib/imageSearch';
import { prepareSearchPhoto } from '@/lib/prepareSearchPhoto';

/** Browser form navigation sends directly to the provider, without a CORS proxy or public photo URL. */
export async function searchPhoto(uri: string, provider: ImageSearchProvider, language: string): Promise<ImageSearchResult> {
  // Reserve the results tab inside the click, before asynchronous image preparation.
  const target = `critterboard-search-${Date.now()}`;
  const results = window.open('about:blank', target);
  if (!results) return 'blocked';
  results.opener = null;
  let prepared: string | undefined;
  let form: HTMLFormElement | undefined;
  try {
    if (!uri.startsWith('blob:') && !uri.startsWith('data:image/')) {
      results.close();
      return 'missing';
    }
    const photo = await prepareSearchPhoto(uri, provider === 'bing');
    prepared = photo.uri;
    if (results.closed) return 'error';
    // Lens accepts opaque/no-referrer form origins, but rejects a cross-site page origin.
    // Keep the upload in the reserved tab; no proxy or hosted copy is needed.
    const page = results.document;
    const referrer = page.createElement('meta');
    referrer.name = 'referrer';
    referrer.content = 'no-referrer';
    page.head.appendChild(referrer);
    form = page.createElement('form');
    form.action = imageSearchUploadUrl(provider, language, 'browser');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.target = '_self';
    form.hidden = true;
    if (provider === 'google') {
      const response = await fetch(photo.uri);
      if (!response.ok) throw new Error('Photo unavailable');
      const transfer = new DataTransfer();
      transfer.items.add(new File([await response.blob()], 'critterboard-photo.jpg', { type: 'image/jpeg' }));
      const input = page.createElement('input');
      input.type = 'file';
      input.name = 'encoded_image';
      input.files = transfer.files;
      form.appendChild(input);
    } else {
      if (!photo.base64) throw new Error('Photo unavailable');
      const input = page.createElement('input');
      input.type = 'hidden';
      input.name = 'imageBin';
      input.value = photo.base64;
      form.appendChild(input);
    }
    page.body.appendChild(form);
    form.submit();
    return 'opened'; // The provider owns results and any account/anti-abuse prompts.
  } catch {
    results.close();
    return 'error';
  } finally {
    form?.remove();
    if (prepared?.startsWith('blob:')) URL.revokeObjectURL(prepared);
  }
}

import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking } from 'react-native';

import { imageSearchResultsUrl, imageSearchUploadUrl, type ImageSearchProvider, type ImageSearchResult } from '@/lib/imageSearch';
import { photoFileUri } from '@/lib/photos';
import { prepareSearchPhoto } from '@/lib/prepareSearchPhoto';

/** Upload directly to the selected provider and open its results. No app backend or photo hosting. */
export async function searchPhoto(uri: string, provider: ImageSearchProvider, language: string): Promise<ImageSearchResult> {
  let prepared: string | undefined;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 30_000);
  try {
    const info = await FileSystem.getInfoAsync(photoFileUri(uri));
    if (!info.exists || info.isDirectory) return 'missing';
    const photo = await prepareSearchPhoto(uri, provider === 'bing');
    prepared = photo.uri;
    const form = new FormData();
    if (provider === 'google') {
      form.append('encoded_image', new File(photo.uri));
    } else {
      if (!photo.base64) return 'error';
      form.append('imageBin', photo.base64);
    }
    const response = await fetch(imageSearchUploadUrl(provider, language), {
      method: 'POST', body: form, redirect: 'manual', credentials: 'omit', signal: abort.signal,
    });
    const results = response.status >= 300 && response.status < 400
      ? imageSearchResultsUrl(provider, response.headers.get('location')) : null;
    // Don't retain provider HTML, cookies or result-session links in app state or logs.
    await response.body?.cancel();
    if (!results) return 'error';
    try {
      await Linking.openURL(results);
      return 'opened';
    } catch {
      return 'openError';
    }
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
    if (prepared) await FileSystem.deleteAsync(prepared, { idempotent: true }).catch(() => undefined);
  }
}

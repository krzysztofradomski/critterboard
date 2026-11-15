export type ImageSearchProvider = 'google' | 'bing';
export type ImageSearchResult = 'opened' | 'missing' | 'error' | 'openError' | 'blocked';

/** Consumer upload flows used by Chromium, not paid recognition APIs. Keep endpoint changes here. */
export function imageSearchUploadUrl(provider: ImageSearchProvider, language: string, transport: 'native' | 'browser' = 'native'): string {
  if (provider === 'google') {
    const url = new URL(transport === 'browser' ? 'https://lens.google.com/upload' : 'https://lens.google.com/v3/upload');
    url.searchParams.set('hl', language);
    return url.toString();
  }
  return 'https://www.bing.com/images/detail/search?iss=sbiupload&FORM=CHROMI';
}

/** Only hand off real provider results; never an arbitrary upload response URL or homepage. */
export function imageSearchResultsUrl(provider: ImageSearchProvider, location: string | null): string | null {
  if (!location) return null;
  try {
    const base = provider === 'google' ? 'https://www.google.com' : 'https://www.bing.com';
    const url = new URL(location, base);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (provider === 'google') {
      return url.hostname === 'www.google.com' && url.pathname === '/search' && !!url.searchParams.get('vsrid') ? url.toString() : null;
    }
    return url.hostname === 'www.bing.com' && url.pathname === '/images/search' && !!url.searchParams.get('insightsToken') ? url.toString() : null;
  } catch {
    return null;
  }
}

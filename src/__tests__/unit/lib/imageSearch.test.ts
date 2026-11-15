import { describe, expect, it } from 'vitest';
import { imageSearchResultsUrl } from '@/lib/imageSearch';

describe('image search results handoff', () => {
  it('accepts real results from the selected provider only', () => {
    expect(imageSearchResultsUrl('google', 'https://www.google.com/search?vsrid=sample')).toBe('https://www.google.com/search?vsrid=sample');
    expect(imageSearchResultsUrl('bing', '/images/search?insightsToken=sample')).toBe('https://www.bing.com/images/search?insightsToken=sample');
  });
  it.each([
    'https://www.google.com.evil.example/search?vsrid=sample',
    'http://www.google.com/search?vsrid=sample',
    'javascript:alert(1)',
    'https://www.google.com/',
    'https://www.google.com/search?q=photo',
    'https://user:password@www.google.com/search?vsrid=sample',
    'https://www.bing.com/images/search?insightsToken=sample',
  ])('rejects an unrelated or unsafe Lens redirect: %s', (url) => {
    expect(imageSearchResultsUrl('google', url)).toBeNull();
  });
});

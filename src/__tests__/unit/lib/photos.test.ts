import { describe, it, expect } from 'vitest';

import { photoFileUri } from '@/lib/photos';

describe('photoFileUri', () => {
  const doc = 'file:///var/mobile/Containers/Data/Application/NEW-UUID/Documents/';

  it('re-roots a kept photo saved under an older app container', () => {
    const old = 'file:///var/mobile/Containers/Data/Application/OLD-UUID/Documents/photos/171-a.jpg';
    expect(photoFileUri(old, doc)).toBe(`${doc}photos/171-a.jpg`);
  });

  it('leaves cache photos, current paths and platforms without documents alone', () => {
    const cache = 'file:///var/mobile/Containers/Data/Application/OLD-UUID/Library/Caches/Camera/x.jpg';
    expect(photoFileUri(cache, doc)).toBe(cache);
    expect(photoFileUri(`${doc}photos/1-b.jpg`, doc)).toBe(`${doc}photos/1-b.jpg`);
    expect(photoFileUri('blob:abc', null)).toBe('blob:abc');
  });

  it('works with the Android files/ folder', () => {
    const adoc = 'file:///data/user/0/app.critterboard/files/';
    expect(photoFileUri('file:///data/user/0/other/files/photos/9-c.jpg', adoc)).toBe(`${adoc}photos/9-c.jpg`);
  });
});

import { describe, expect, it } from 'vitest';

import { visionModelActions } from '@/lib/modelActions';

describe('visionModelActions', () => {
  it('offers nothing for a pack that is not installed', () => {
    expect(visionModelActions({ installed: false, fileExists: false, loaded: false })).toEqual([]);
  });
  it('offers unload only while the model is in memory', () => {
    expect(visionModelActions({ installed: true, fileExists: true, loaded: true })).toEqual(['unload', 'deleteFile']);
    expect(visionModelActions({ installed: true, fileExists: true, loaded: false })).toEqual(['deleteFile']);
  });
  it('offers download when the model file is gone', () => {
    expect(visionModelActions({ installed: true, fileExists: false, loaded: false })).toEqual(['download']);
  });
});

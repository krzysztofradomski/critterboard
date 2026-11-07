import { describe, expect, it } from 'vitest';

import { isScanDoubleTap } from '@/lib/scanTap';

describe('isScanDoubleTap', () => {
  const first = { point: { x: 100, y: 200 }, at: 1000 };

  it('accepts a quick second tap on the same subject', () => {
    expect(isScanDoubleTap(first, { x: 116, y: 208 }, 1300)).toBe(true);
  });

  it('treats a first tap, a delayed tap and a tap on a different subject as focus only', () => {
    expect(isScanDoubleTap(null, first.point, 1100)).toBe(false);
    expect(isScanDoubleTap(first, first.point, 1301)).toBe(false);
    expect(isScanDoubleTap(first, { x: 124, y: 224 }, 1100)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { createThinkFilter } from '@/ai/thinkFilter';

const run = (chunks: string[]) => {
  const f = createThinkFilter();
  return chunks.map((c) => f.push(c)).join('') + f.end();
};

describe('createThinkFilter', () => {
  it('drops an empty think block at the start, split across chunks', () => {
    expect(run(['<thi', 'nk>\n', '\n</think>', '\n\nHel', 'lo'])).toBe('Hello');
  });
  it('drops a non-empty think block too', () => {
    expect(run(['<think>let me see</think> Hi there'])).toBe('Hi there');
  });
  it('passes a reply without a think block through untouched', () => {
    expect(run(['Hello ', '<think> is just text here'])).toBe('Hello <think> is just text here');
    expect(run(['<', 'b>bold'])).toBe('<b>bold');
  });
  it('streams text as soon as it is known not to be a think block', () => {
    const f = createThinkFilter();
    expect(f.push('<th')).toBe('');
    expect(f.push('e cat')).toBe('<the cat');
  });
  it('flushes a held prefix when the stream ends', () => {
    expect(run(['<th'])).toBe('<th');
  });
  it('drops an unclosed think block', () => {
    expect(run(['<think>still reasoning'])).toBe('');
  });
});

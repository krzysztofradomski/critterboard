/**
 * Drops a leading `<think>…</think>` block (and the whitespace after it) from a streamed reply.
 *
 * Qwen3 is run with thinking off (`enable_thinking: false`), but its chat template can still
 * open the reply with an empty think block. Text is held only while it could still be the
 * start of that block; anything else streams straight through, and a `<think>` later in a
 * reply is left alone. An unclosed block (generation stopped mid-thought) yields nothing.
 */
const OPEN = '<think>';
const CLOSE = '</think>';

export function createThinkFilter(): { push(chunk: string): string; end(): string } {
  let state: 'start' | 'think' | 'after' | 'pass' = 'start';
  let buf = '';

  const push = (chunk: string): string => {
    buf += chunk;
    for (;;) {
      if (state === 'pass') {
        const out = buf;
        buf = '';
        return out;
      }
      if (state === 'start') {
        const s = buf.trimStart();
        if (s.length === 0 || (s.length < OPEN.length && OPEN.startsWith(s))) return '';
        if (s.startsWith(OPEN)) {
          state = 'think';
          buf = s.slice(OPEN.length);
          continue;
        }
        state = 'pass';
        continue;
      }
      if (state === 'think') {
        const i = buf.indexOf(CLOSE);
        if (i < 0) {
          // Keep just enough to catch a closing tag split across chunks.
          buf = buf.slice(Math.max(0, buf.length - (CLOSE.length - 1)));
          return '';
        }
        buf = buf.slice(i + CLOSE.length);
        state = 'after';
        continue;
      }
      // after: drop the whitespace that follows the block
      const s = buf.replace(/^\s+/, '');
      if (s.length === 0) {
        buf = '';
        return '';
      }
      buf = s;
      state = 'pass';
    }
  };

  const end = (): string => {
    const out = state === 'start' || state === 'pass' ? buf : '';
    buf = '';
    return out;
  };

  return { push, end };
}

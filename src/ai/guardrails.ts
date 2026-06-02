import type { ChatAdapter, ChatReplyParams } from '@/ai/chatAdapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardCode = 'INPUT_TOO_LONG' | 'PROMPT_INJECTION' | 'BLOCKED_CONTENT';

export type GuardResult =
  | { pass: true }
  | { pass: false; reason: string; code: GuardCode };

export type GuardrailsConfig = {
  /** Maximum allowed characters in user input. Default: 600 */
  maxInputLength?: number;
  /** Detect and block prompt injection / jailbreak attempts. Default: true */
  detectPromptInjection?: boolean;
  /** Redact PII patterns (emails, phone numbers) from LLM output chunks. Default: true */
  redactOutputPii?: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  maxInputLength: 600,
  detectPromptInjection: true,
  redactOutputPii: true,
} satisfies Required<GuardrailsConfig>;

// ---------------------------------------------------------------------------
// Prompt injection patterns
// ---------------------------------------------------------------------------

// Patterns that suggest the user is trying to override the system prompt or
// exploit instruction-following behaviour of the underlying model.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|above|all|prior)\s+instructions?/i,
  /forget\s+(your|all|the)\s+(previous\s+)?(instructions?|prompt|rules?|context)/i,
  /new\s+system\s+prompt/i,
  /disregard\s+(all\s+)?(previous\s+)?(instructions?|rules?|guidelines?)/i,
  /override\s+(your\s+)?(instructions?|programming|safety|guidelines?)/i,
  /\bjailbreak\b/i,
  // "DAN mode" and similar activation phrases
  /\bdan\b.{0,20}mode/i,
  // Raw special tokens sometimes used to inject a new turn
  /<\|im_start\|>|<\|im_end\|>|<\|system\|>/,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/,
  // "You are now X" — unless X is clearly insect-related
  /you\s+are\s+now\s+(?!an?\s+insect|an?\s+entomologist|an?\s+naturalist)/i,
  // "act as / pretend to be" — unless clearly insect-related
  /(?:act\s+as|pretend\s+to\s+be)\s+(?!an?\s+insect|an?\s+entomologist|an?\s+naturalist)/i,
];

// ---------------------------------------------------------------------------
// PII patterns for output redaction
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ re: RegExp; sub: string }> = [
  // Email addresses
  {
    re: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    sub: '[email]',
  },
  // Phone numbers in common formats (US-centric but catches most)
  {
    re: /\b(\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
    sub: '[phone]',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate user input before it reaches the LLM.
 * Returns `{ pass: true }` when the input is acceptable, or a reason and
 * code when it should be rejected.
 */
export function checkInput(text: string, config?: GuardrailsConfig): GuardResult {
  const cfg = { ...DEFAULTS, ...config };

  if (text.length > cfg.maxInputLength) {
    return {
      pass: false,
      code: 'INPUT_TOO_LONG',
      reason: `Your message is a bit long (${text.length} chars). Keep it under ${cfg.maxInputLength} — I'm a bug expert, not a speed reader.`,
    };
  }

  if (cfg.detectPromptInjection) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          pass: false,
          code: 'PROMPT_INJECTION',
          reason: "That looks like a prompt injection attempt. Let's stick to insects! 🐛",
        };
      }
    }
  }

  return { pass: true };
}

/**
 * Redact PII patterns (emails, phone numbers) from a string.
 * Applied chunk-by-chunk on LLM output; cross-chunk PII is an accepted
 * limitation given the streaming model.
 */
export function redactPii(text: string): string {
  return PII_PATTERNS.reduce((s, { re, sub }) => s.replace(re, sub), text);
}

/**
 * Wrap any `ChatAdapter` with input and output guardrails.
 *
 * - Input: rejected messages yield a friendly error string and return early
 *   so the underlying adapter is never called.
 * - Output: each chunk is run through PII redaction before being yielded to
 *   the caller.
 */
export function withGuardrails(adapter: ChatAdapter, config?: GuardrailsConfig): ChatAdapter {
  const cfg = { ...DEFAULTS, ...config };

  return {
    ready: () => adapter.ready(),

    async *streamReply(params: ChatReplyParams): AsyncIterable<string> {
      const check = checkInput(params.userText, cfg);
      if (!check.pass) {
        yield check.reason;
        return;
      }

      for await (const chunk of adapter.streamReply(params)) {
        yield cfg.redactOutputPii ? redactPii(chunk) : chunk;
      }
    },
  };
}

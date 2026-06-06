import type { ChatAdapter, ChatReplyParams } from '@/ai/chatAdapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardCode = 'INPUT_TOO_LONG' | 'PROMPT_INJECTION' | 'BLOCKED_CONTENT' | 'PII_DETECTED';

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

  // Presidio integration — all optional; falls back to regex when absent or unreachable

  /** Base URL of the Presidio guard-rails service (e.g. http://localhost:8000).
   *  When set, async checks use Presidio for richer, NLP-backed PII detection. */
  presidioUrl?: string;
  /** Entities Presidio should look for in user INPUT. Defaults to high-confidence
   *  PII that should never appear in a chat message (credit cards, SSNs, etc.). */
  presidioInputEntities?: string[];
  /** Presidio confidence threshold for input checks (0–1). Default: 0.7 */
  presidioInputScoreThreshold?: number;
  /** Entities Presidio should detect and replace in LLM OUTPUT. Defaults to a
   *  broad PII set including email, phone, names, and locations. */
  presidioOutputEntities?: string[];
  /** Presidio confidence threshold for output redaction (0–1). Default: 0.5 */
  presidioOutputScoreThreshold?: number;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  maxInputLength: 600,
  detectPromptInjection: true,
  redactOutputPii: true,
} satisfies Required<Pick<GuardrailsConfig, 'maxInputLength' | 'detectPromptInjection' | 'redactOutputPii'>>;

// PII entity types that are always suspicious in user input to an LLM persona.
// PERSON / LOCATION are intentionally excluded here — mentioning "I saw a bug
// near London" or a name in context is legitimate in an insect-ID app.
const DEFAULT_INPUT_ENTITIES = [
  'EMAIL_ADDRESS',
  'PHONE_NUMBER',
  'CREDIT_CARD',
  'IBAN_CODE',
  'US_SSN',
  'US_DRIVER_LICENSE',
  'US_PASSPORT',
  'IP_ADDRESS',
  'MEDICAL_LICENSE',
] as const;

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
// PII patterns for output redaction (synchronous / regex fallback)
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
// Presidio helpers
// ---------------------------------------------------------------------------

type PresidioEntityHit = {
  entity_type: string;
  start: number;
  end: number;
  score: number;
  text: string;
};

type PresidioAnonymizeResponse = {
  text: string;
  entities_found: string[];
};

async function presidioAnalyze(
  text: string,
  presidioUrl: string,
  options: {
    entities?: readonly string[];
    score_threshold?: number;
    language?: string;
  } = {},
): Promise<PresidioEntityHit[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${presidioUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: options.language ?? 'en',
        entities: options.entities ? [...options.entities] : undefined,
        score_threshold: options.score_threshold ?? 0.5,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    return (await res.json()) as PresidioEntityHit[];
  } finally {
    clearTimeout(timer);
  }
}

async function presidioAnonymize(
  text: string,
  presidioUrl: string,
  options: {
    entities?: readonly string[];
    score_threshold?: number;
    language?: string;
  } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(`${presidioUrl}/anonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: options.language ?? 'en',
        entities: options.entities ? [...options.entities] : undefined,
        score_threshold: options.score_threshold ?? 0.5,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return text;
    const data = (await res.json()) as PresidioAnonymizeResponse;
    return data.text;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public sync API (unchanged — safe to call from anywhere)
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
 * Redact PII patterns (emails, phone numbers) from a string using regex.
 * Applied chunk-by-chunk on LLM output; cross-chunk PII is an accepted
 * limitation given the streaming model.
 */
export function redactPii(text: string): string {
  return PII_PATTERNS.reduce((s, { re, sub }) => s.replace(re, sub), text);
}

// ---------------------------------------------------------------------------
// Public async API — uses Presidio when presidioUrl is configured, falls back
// to the sync regex-based implementations when Presidio is unavailable.
// ---------------------------------------------------------------------------

/**
 * Async version of `checkInput` that also queries Presidio for high-confidence
 * PII (credit cards, SSNs, IBANs, etc.) when `config.presidioUrl` is set.
 * Falls back gracefully to the sync regex checks if the service is unreachable.
 */
export async function checkInputAsync(text: string, config?: GuardrailsConfig): Promise<GuardResult> {
  // Sync checks first — fast, no network
  const syncResult = checkInput(text, config);
  if (!syncResult.pass) return syncResult;

  if (!config?.presidioUrl) return { pass: true };

  try {
    const entities = await presidioAnalyze(text, config.presidioUrl, {
      entities: config.presidioInputEntities ?? DEFAULT_INPUT_ENTITIES,
      score_threshold: config.presidioInputScoreThreshold ?? 0.7,
    });

    if (entities.length > 0) {
      const types = [...new Set(entities.map((e) => e.entity_type.toLowerCase().replace(/_/g, ' ')))];
      return {
        pass: false,
        code: 'PII_DETECTED',
        reason: `Your message appears to contain sensitive info (${types.join(', ')}). Please remove it before chatting.`,
      };
    }
  } catch {
    // Presidio unavailable — fail open and allow the message through
  }

  return { pass: true };
}

/**
 * Async version of `redactPii` that uses Presidio's anonymizer for richer,
 * NLP-backed redaction when `config.presidioUrl` is set.
 * Falls back to the sync regex implementation if the service is unreachable.
 */
export async function redactPiiAsync(text: string, config?: GuardrailsConfig): Promise<string> {
  if (config?.presidioUrl) {
    try {
      return await presidioAnonymize(text, config.presidioUrl, {
        entities: config.presidioOutputEntities,
        score_threshold: config.presidioOutputScoreThreshold ?? 0.5,
      });
    } catch {
      // Presidio unavailable — fall through to regex
    }
  }
  return redactPii(text);
}

// ---------------------------------------------------------------------------
// Chat adapter wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap any `ChatAdapter` with input and output guardrails.
 *
 * - Input: uses async Presidio check (if `presidioUrl` is configured) then
 *   regex injection detection.  Rejected messages yield a friendly error string
 *   and return early so the underlying adapter is never called.
 * - Output: each chunk is run through regex PII redaction before being yielded.
 *   For full-document Presidio redaction, callers can post-process the assembled
 *   response with `redactPiiAsync`.
 */
export function withGuardrails(adapter: ChatAdapter, config?: GuardrailsConfig): ChatAdapter {
  const cfg = { ...DEFAULTS, ...config };

  return {
    ready: () => adapter.ready(),

    async *streamReply(params: ChatReplyParams): AsyncIterable<string> {
      const check = await checkInputAsync(params.userText, cfg);
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

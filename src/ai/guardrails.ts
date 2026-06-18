import {
  GuardrailsEngine,
  SelectionType,
  injectionGuard,
  leakageGuard,
  secretGuard,
  piiGuard,
} from '@presidio-dev/hai-guardrails';
import type { GuardrailsEngineResult } from '@presidio-dev/hai-guardrails';
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
  /** Detect and block prompt injection / jailbreak attempts via both regex and
   *  the hai-guardrails InjectionGuard + LeakageGuard. Default: true */
  detectPromptInjection?: boolean;
  /** Redact PII patterns from LLM output chunks. Default: true */
  redactOutputPii?: boolean;
  /** hai-guardrails InjectionGuard heuristic threshold (0–1). Default: 0.7 */
  injectionThreshold?: number;
  /** hai-guardrails LeakageGuard heuristic threshold (0–1). Default: 0.7 */
  leakageThreshold?: number;
  /** Run SecretGuard to block messages that contain credentials / API keys.
   *  Default: true */
  detectSecrets?: boolean;
  /** Run PIIGuard in redact mode so PII is scrubbed from the user's message
   *  before it reaches the LLM. Default: false */
  redactInputPii?: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS = {
  maxInputLength: 600,
  detectPromptInjection: true,
  redactOutputPii: true,
  injectionThreshold: 0.7,
  leakageThreshold: 0.7,
  detectSecrets: true,
  redactInputPii: false,
} satisfies Required<GuardrailsConfig>;

// ---------------------------------------------------------------------------
// Regex fallbacks (sync, applied to output chunks and as a fast pre-check)
// ---------------------------------------------------------------------------

// Catches the most obvious injection patterns before the async engine runs.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|above|all|prior)\s+instructions?/i,
  /forget\s+(your|all|the)\s+(previous\s+)?(instructions?|prompt|rules?|context)/i,
  /new\s+system\s+prompt/i,
  /disregard\s+(all\s+)?(previous\s+)?(instructions?|rules?|guidelines?)/i,
  /override\s+(your\s+)?(instructions?|programming|safety|guidelines?)/i,
  /\bjailbreak\b/i,
  /\bdan\b.{0,20}mode/i,
  /<\|im_start\|>|<\|im_end\|>|<\|system\|>/,
  /\[INST\]|\[\/INST\]|<<SYS>>|<\/SYS>/,
  /you\s+are\s+now\s+(?!an?\s+insect|an?\s+entomologist|an?\s+naturalist)/i,
  /(?:act\s+as|pretend\s+to\s+be)\s+(?!an?\s+insect|an?\s+entomologist|an?\s+naturalist)/i,
];

const PII_PATTERNS: Array<{ re: RegExp; sub: string }> = [
  { re: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g, sub: '[email]' },
  { re: /\b(\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g, sub: '[phone]' },
];

// ---------------------------------------------------------------------------
// Public sync API (backwards-compatible, no network required)
// ---------------------------------------------------------------------------

/**
 * Validate user input before it reaches the LLM — synchronous, regex-only.
 * Used as a fast pre-check inside `withGuardrails`; also available standalone.
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
 * Redact PII (emails, phone numbers) from a string using regex.
 * Applied chunk-by-chunk on LLM output; cross-chunk PII is an accepted
 * limitation of the streaming model.
 */
export function redactPii(text: string): string {
  return PII_PATTERNS.reduce((s, { re, sub }) => s.replace(re, sub), text);
}

// ---------------------------------------------------------------------------
// hai-guardrails engine
// ---------------------------------------------------------------------------

const USER_SCOPE = {
  roles: ['user'] as Array<'user'>,
  selection: SelectionType.All,
};

function buildEngine(cfg: Required<GuardrailsConfig>): GuardrailsEngine {
  const guards = [];

  if (cfg.detectPromptInjection) {
    // 'pattern' mode uses pure regex — 'heuristic' mode spawns worker threads
    // via piscina which has path-resolution issues when installed as a
    // dependency (hardcoded build paths).  Pattern mode is fast and reliable.
    guards.push(
      injectionGuard(USER_SCOPE, { mode: 'pattern', threshold: cfg.injectionThreshold }),
      leakageGuard(USER_SCOPE, { mode: 'pattern', threshold: cfg.leakageThreshold }),
    );
  }

  if (cfg.detectSecrets) {
    guards.push(secretGuard(USER_SCOPE));
  }

  // PIIGuard in redact mode rewrites the message but doesn't block it —
  // the sanitised text surfaces in result.messages[0].content.
  if (cfg.redactInputPii) {
    guards.push(piiGuard({ ...USER_SCOPE, mode: 'redact' }));
  }

  return new GuardrailsEngine({ guards });
}

/** Find the first guard result that explicitly blocked a message. */
function findBlock(result: GuardrailsEngineResult): { guardName: string } | null {
  for (const g of result.messagesWithGuardResult) {
    if (g.messages.some((m) => m.inScope && !m.passed)) {
      return { guardName: g.guardName };
    }
  }
  return null;
}

function guardBlockReason(guardName: string): string {
  if (/secret/i.test(guardName)) {
    return "Your message appears to contain credentials or API keys. Please remove them before chatting.";
  }
  if (/leak/i.test(guardName)) {
    return "I can't share details about my instructions. Let's chat about insects instead! 🐛";
  }
  return "That message was flagged by our safety system. Let's chat about bugs instead! 🐛";
}

// ---------------------------------------------------------------------------
// Chat adapter wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap any `ChatAdapter` with layered guardrails:
 *
 * 1. **Length check** (sync) — fast early exit before any other processing.
 * 2. **Regex injection check** (sync) — catches obvious patterns immediately.
 * 3. **hai-guardrails engine** (async) — InjectionGuard, LeakageGuard,
 *    SecretGuard, and optionally PIIGuard in redact mode.
 * 4. **Regex PII redaction** (sync, per chunk) — applied to each LLM output
 *    chunk before it is yielded to the caller.
 *
 * The engine fails open: if it throws, the message is allowed through and the
 * sync checks remain the safety net.
 */
export function withGuardrails(adapter: ChatAdapter, config?: GuardrailsConfig): ChatAdapter {
  const cfg = { ...DEFAULTS, ...config };
  const engine = buildEngine(cfg);

  return {
    ready: () => adapter.ready(),

    async *streamReply(params: ChatReplyParams): AsyncIterable<string> {
      // ── Layer 1 & 2: sync pre-checks ─────────────────────────────────────
      const syncCheck = checkInput(params.userText, cfg);
      if (!syncCheck.pass) {
        yield syncCheck.reason;
        return;
      }

      // ── Layer 3: hai-guardrails engine ────────────────────────────────────
      let effectiveText = params.userText;
      try {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('guardrails_timeout')), 5_000),
        );
        const result = await Promise.race([
          engine.run([{ role: 'user', content: params.userText }]),
          timeout,
        ]);
        const block = findBlock(result);
        if (block) {
          yield guardBlockReason(block.guardName);
          return;
        }
        // If PIIGuard ran in redact mode, result.messages[0].content contains
        // the sanitised text — pass that to the LLM instead of the original.
        const sanitised = result.messages[0]?.content;
        if (sanitised !== undefined && sanitised !== params.userText) {
          effectiveText = sanitised;
        }
      } catch {
        // Engine error — fail open, original text used
      }

      // ── Layer 4: stream + regex output redaction ───────────────────────────
      const effectiveParams =
        effectiveText === params.userText ? params : { ...params, userText: effectiveText };

      for await (const chunk of adapter.streamReply(effectiveParams)) {
        yield cfg.redactOutputPii ? redactPii(chunk) : chunk;
      }
    },
  };
}

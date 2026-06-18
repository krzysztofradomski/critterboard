import type { ChatAdapter } from "@/ai/chatAdapter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardCode =
  | "INPUT_TOO_LONG"
  | "PROMPT_INJECTION"
  | "BLOCKED_CONTENT";

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

export const GUARDRAILS_DEFAULTS = {
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
export const INJECTION_PATTERNS: RegExp[] = [
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

export const PII_PATTERNS: Array<{ re: RegExp; sub: string }> = [
  {
    re: /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g,
    sub: "[email]",
  },
  {
    re: /\b(\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
    sub: "[phone]",
  },
];

/**
 * Validate user input before it reaches the LLM — synchronous, regex-only.
 * Used as a fast pre-check inside `withGuardrails`; also available standalone.
 */
export function checkInput(
  text: string,
  config?: GuardrailsConfig,
): GuardResult {
  const cfg = { ...GUARDRAILS_DEFAULTS, ...config };

  if (text.length > cfg.maxInputLength) {
    return {
      pass: false,
      code: "INPUT_TOO_LONG",
      reason: `Your message is a bit long (${text.length} chars). Keep it under ${cfg.maxInputLength} — I'm a bug expert, not a speed reader.`,
    };
  }

  if (cfg.detectPromptInjection) {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(text)) {
        return {
          pass: false,
          code: "PROMPT_INJECTION",
          reason:
            "That looks like a prompt injection attempt. Let's stick to insects! 🐛",
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

export type { ChatAdapter };

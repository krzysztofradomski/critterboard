import type { ChatAdapter } from "@/ai/chatAdapter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GuardCode =
  | "INPUT_TOO_LONG"
  | "PROMPT_INJECTION"
  | "PROMPT_LEAKAGE"
  | "SECRET_DETECTED"
  | "BLOCKED_CONTENT";

export type GuardResult =
  | { pass: true }
  | { pass: false; reason: string; code: GuardCode };

export type GuardrailsConfig = {
  /** Maximum allowed characters in user input. Default: 600 */
  maxInputLength?: number;
  /** Block prompt injection / jailbreak attempts and requests to reveal the
   *  system prompt. Default: true */
  detectPromptInjection?: boolean;
  /** Redact PII patterns from LLM output chunks. Default: true */
  redactOutputPii?: boolean;
  /** Block messages that contain credentials / API keys. Default: true */
  detectSecrets?: boolean;
  /** Scrub PII from the user's message before it reaches the LLM.
   *  Default: false */
  redactInputPii?: boolean;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const GUARDRAILS_DEFAULTS = {
  maxInputLength: 600,
  detectPromptInjection: true,
  redactOutputPii: true,
  detectSecrets: true,
  redactInputPii: false,
} satisfies Required<GuardrailsConfig>;

// ---------------------------------------------------------------------------
// Patterns (sync, regex-only so they run on Hermes, web and Node alike)
// ---------------------------------------------------------------------------

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

// Attempts to extract the hidden system prompt / instructions.
export const LEAKAGE_PATTERNS: RegExp[] = [
  /\b(show|reveal|print|repeat|display|output|leak|dump|give|tell)\b.{0,20}\b(system|initial|hidden|original|developer)\s+(prompt|instructions?|message)/i,
  /\b(show|reveal|print|repeat|display|output|leak|dump)\b.{0,20}\byour\s+(prompt|instructions?|rules|guidelines)/i,
  /what\s+(is|are|was|were)\s+your\s+(system\s+)?(prompt|instructions?)/i,
];

// Well-known credential formats plus generic `key = value` assignments.
export const SECRET_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}/, // GitHub
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, // OpenAI / Anthropic
  /\bAIza[0-9A-Za-z_-]{35}\b/, // Google API key
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/, // Slack
  /\b[rs]k_(?:live|test)_[A-Za-z0-9]{16,}/, // Stripe
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/, // PEM private key
  /\beyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/, // JWT
  /\b(api[_-]?key|secret|token|passw(or)?d|access[_-]?key)\b\s*[:=]\s*["']?[^\s"']{8,}/i,
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
 * Used inside `withGuardrails`; also available standalone.
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

  if (cfg.detectSecrets && SECRET_PATTERNS.some((re) => re.test(text))) {
    return {
      pass: false,
      code: "SECRET_DETECTED",
      reason:
        "Your message appears to contain credentials or API keys. Please remove them before chatting.",
    };
  }

  if (cfg.detectPromptInjection) {
    if (INJECTION_PATTERNS.some((re) => re.test(text))) {
      return {
        pass: false,
        code: "PROMPT_INJECTION",
        reason:
          "That looks like a prompt injection attempt. Let's stick to insects! 🐛",
      };
    }
    if (LEAKAGE_PATTERNS.some((re) => re.test(text))) {
      return {
        pass: false,
        code: "PROMPT_LEAKAGE",
        reason:
          "I can't share details about my instructions. Let's chat about insects instead! 🐛",
      };
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

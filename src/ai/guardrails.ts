import {
  GuardrailsEngine,
  SelectionType,
  injectionGuard,
  leakageGuard,
  secretGuard,
  piiGuard,
} from "@presidio-dev/hai-guardrails";
import type { GuardrailsEngineResult } from "@presidio-dev/hai-guardrails";
import type { ChatAdapter, ChatReplyParams } from "@/ai/chatAdapter";
import {
  GUARDRAILS_DEFAULTS,
  checkInput,
  redactPii,
  type GuardrailsConfig,
} from "@/ai/guardrailsCore";

export type {
  GuardCode,
  GuardResult,
  GuardrailsConfig,
} from "@/ai/guardrailsCore";
export { checkInput, redactPii } from "@/ai/guardrailsCore";

// ---------------------------------------------------------------------------
// hai-guardrails engine
// ---------------------------------------------------------------------------

const USER_SCOPE = {
  roles: ["user"] as Array<"user">,
  selection: SelectionType.All,
};

function buildEngine(cfg: Required<GuardrailsConfig>): GuardrailsEngine {
  const guards = [];

  if (cfg.detectPromptInjection) {
    // 'pattern' mode uses pure regex — 'heuristic' mode spawns worker threads
    // via piscina which has path-resolution issues when installed as a
    // dependency (hardcoded build paths).  Pattern mode is fast and reliable.
    guards.push(
      injectionGuard(USER_SCOPE, {
        mode: "pattern",
        threshold: cfg.injectionThreshold,
      }),
      leakageGuard(USER_SCOPE, {
        mode: "pattern",
        threshold: cfg.leakageThreshold,
      }),
    );
  }

  if (cfg.detectSecrets) {
    guards.push(secretGuard(USER_SCOPE));
  }

  // PIIGuard in redact mode rewrites the message but doesn't block it —
  // the sanitised text surfaces in result.messages[0].content.
  if (cfg.redactInputPii) {
    guards.push(piiGuard({ ...USER_SCOPE, mode: "redact" }));
  }

  return new GuardrailsEngine({ guards });
}

/** Find the first guard result that explicitly blocked a message. */
function findBlock(
  result: GuardrailsEngineResult,
): { guardName: string } | null {
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
export function withGuardrails(
  adapter: ChatAdapter,
  config?: GuardrailsConfig,
): ChatAdapter {
  const cfg = { ...GUARDRAILS_DEFAULTS, ...config };
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
          setTimeout(() => reject(new Error("guardrails_timeout")), 5_000),
        );
        const result = await Promise.race([
          engine.run([{ role: "user", content: params.userText }]),
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
        effectiveText === params.userText
          ? params
          : { ...params, userText: effectiveText };

      for await (const chunk of adapter.streamReply(effectiveParams)) {
        yield cfg.redactOutputPii ? redactPii(chunk) : chunk;
      }
    },
  };
}

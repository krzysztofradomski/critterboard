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

/**
 * Wrap any `ChatAdapter` with layered guardrails. Same code on iOS, Android
 * and web — everything is synchronous regex, so it runs under Hermes.
 *
 * 1. **Input checks** (`checkInput`) — length, credentials / API keys,
 *    prompt injection, system-prompt leakage. A blocked message never
 *    reaches the model.
 * 2. **Input PII redaction** (opt-in) — the model sees `[email]` / `[phone]`
 *    instead of the user's contact details.
 * 3. **Output PII redaction** — applied to each streamed chunk.
 *
 * An earlier native build used `@presidio-dev/hai-guardrails` for the input
 * layer; it is Node-only (`node:module`, piscina worker threads) and broke
 * the iOS/Android bundle, so its guards were ported to regex here.
 */
export function withGuardrails(
  adapter: ChatAdapter,
  config?: GuardrailsConfig,
): ChatAdapter {
  const cfg = { ...GUARDRAILS_DEFAULTS, ...config };

  return {
    ready: () => adapter.ready(),

    async *streamReply(params: ChatReplyParams): AsyncIterable<string> {
      const check = checkInput(params.userText, cfg);
      if (!check.pass) {
        yield check.reason;
        return;
      }

      const userText = cfg.redactInputPii
        ? redactPii(params.userText)
        : params.userText;
      const effectiveParams =
        userText === params.userText ? params : { ...params, userText };

      for await (const chunk of adapter.streamReply(effectiveParams)) {
        yield cfg.redactOutputPii ? redactPii(chunk) : chunk;
      }
    },
  };
}

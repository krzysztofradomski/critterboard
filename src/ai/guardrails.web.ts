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
 * Web build: sync regex guardrails only.
 *
 * `@presidio-dev/hai-guardrails` pulls in piscina worker threads and
 * `import.meta`, which cannot run in the browser bundle.
 */
export function withGuardrails(
  adapter: ChatAdapter,
  config?: GuardrailsConfig,
): ChatAdapter {
  const cfg = { ...GUARDRAILS_DEFAULTS, ...config };

  return {
    ready: () => adapter.ready(),

    async *streamReply(params: ChatReplyParams): AsyncIterable<string> {
      const syncCheck = checkInput(params.userText, cfg);
      if (!syncCheck.pass) {
        yield syncCheck.reason;
        return;
      }

      for await (const chunk of adapter.streamReply(params)) {
        yield cfg.redactOutputPii ? redactPii(chunk) : chunk;
      }
    },
  };
}

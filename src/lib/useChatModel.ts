import { useSyncExternalStore } from 'react';

import { chatModelState, subscribeChatModel, type ChatModelState } from '@/ai/chatModel';

/** Download/load status of the on-device chat model (Qwen3 1.7B). */
export function useChatModel(): ChatModelState {
  return useSyncExternalStore(subscribeChatModel, chatModelState, chatModelState);
}

import { useSyncExternalStore } from 'react';

import { chatModelState, subscribeChatModel, type ChatModelState } from '@/ai/chatModel';

/** Download/load status of the on-device chat model (Gemma 4). */
export function useChatModel(): ChatModelState {
  return useSyncExternalStore(subscribeChatModel, chatModelState, chatModelState);
}

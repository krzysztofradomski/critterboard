import type { ChatModelStatus } from '@/ai/chatModel';

/** What the Brains chat-model row can offer: memory and disk are separate choices. */
export type ChatModelAction = 'download' | 'load' | 'unload' | 'delete';

export function chatModelActions(status: ChatModelStatus): ChatModelAction[] {
  switch (status) {
    case 'ready':
      return ['unload', 'delete'];
    case 'ejected':
      return ['load', 'delete'];
    case 'absent':
      return ['download'];
    case 'error':
      // A broken file may still be on disk: retry, or free the space.
      return ['download', 'delete'];
    case 'downloading':
    case 'loading':
      return ['delete'];
    default:
      // unsupported, tooLittleRam, checking
      return [];
  }
}

/** What Region detail can offer for a pack's species model. */
export type VisionModelAction = 'download' | 'unload' | 'deleteFile';

export function visionModelActions(s: { installed: boolean; fileExists: boolean; loaded: boolean }): VisionModelAction[] {
  if (!s.installed) return [];
  if (!s.fileExists) return ['download'];
  return s.loaded ? ['unload', 'deleteFile'] : ['deleteFile'];
}

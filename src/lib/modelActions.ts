/** What Region detail can offer for a pack's species model. */
export type VisionModelAction = 'download' | 'unload' | 'deleteFile';

export function visionModelActions(s: { installed: boolean; fileExists: boolean; loaded: boolean }): VisionModelAction[] {
  if (!s.installed) return [];
  if (!s.fileExists) return ['download'];
  return s.loaded ? ['unload', 'deleteFile'] : ['deleteFile'];
}

import type { Candidate } from './vision';

/** Web stub: live identification needs the phone's camera frames and the native model. */
export function useLiveGuess(_opts: { enabled: boolean; classify: unknown; cameraRef: unknown; reticle: unknown }) {
  return {
    frameOutput: undefined,
    guess: null as Candidate | null,
    onPreviewStarted: () => undefined,
    idle: () => Promise.resolve(),
  };
}

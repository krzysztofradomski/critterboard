/**
 * Live identification on the Scan preview: a few times a second, the camera frame is cropped to
 * the reticle (the whole frame squashed to the model input loses a small bug, see scanCrops),
 * turned upright, resized to the model input and classified. Scan shows the top guess and snaps
 * on its own once the same species stays confident.
 *
 * Threads: the frame callback only throttles; the crop runs on VisionCamera's async runner (off
 * the camera thread), and the RGB bytes go to the JS thread, where the ExecuTorch module runs.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScalarType } from 'react-native-executorch';
import { useSharedValue } from 'react-native-reanimated';
import {
  HybridFrameConverter,
  useAsyncRunner,
  useFrameOutput,
  type CameraRef,
  type Frame,
  type Point,
} from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { toRgb, uprightDegrees } from './livePixels';
import type { Candidate } from './vision';

/** Model input size (px); the crop is resized to it. */
const SIZE = 256;
/** Time between live guesses (ms). One inference is ~90 ms on a phone CPU. */
const INTERVAL_MS = 500;

type Rect = { x: number; y: number; width: number; height: number };
type Classify = (frame: unknown, opts?: { topK?: number }) => Promise<Candidate[]>;

export function useLiveGuess({
  enabled,
  classify,
  cameraRef,
  reticle,
}: {
  /** Off while a photo is analysed, the model isn't ready, or there is no camera. */
  enabled: boolean;
  classify: Classify;
  cameraRef: React.RefObject<CameraRef | null>;
  /** The reticle in view coordinates (pt). */
  reticle: Rect;
}) {
  const [guess, setGuess] = useState<Candidate | null>(null);
  // The reticle's corners in camera coordinates, set once the preview runs and again after a zoom
  // (see `onPreviewStarted`).
  const corners = useSharedValue<[Point, Point] | null>(null);
  const live = useSharedValue(false);
  const lastAt = useSharedValue(0);
  // The guess in flight: a photo waits for it, as the model runs one input at a time.
  const inflight = useRef<Promise<unknown> | null>(null);
  const asyncRunner = useAsyncRunner();

  useEffect(() => {
    live.value = enabled;
    if (!enabled) setGuess(null);
  }, [enabled, live]);

  const onPreviewStarted = useCallback(() => {
    const cam = cameraRef.current;
    if (!cam) return;
    try {
      corners.value = [
        cam.convertViewPointToCameraPoint({ x: reticle.x, y: reticle.y }),
        cam.convertViewPointToCameraPoint({ x: reticle.x + reticle.width, y: reticle.y + reticle.height }),
      ];
    } catch {
      // Preview not ready yet: keep what we had (no live guesses until it is; photos still work).
    }
  }, [cameraRef, corners, reticle.x, reticle.y, reticle.width, reticle.height]);

  // JS thread: one guess at a time; a frame that arrives while one runs is simply skipped.
  const onPixels = useCallback(
    (rgb: Uint8Array) => {
      if (inflight.current || !live.value) return;
      inflight.current = classify({ dataPtr: rgb, sizes: [SIZE, SIZE, 3], scalarType: ScalarType.BYTE }, { topK: 1 })
        .then((c) => live.value && setGuess(c[0] ?? null))
        .catch(() => undefined)
        .finally(() => {
          inflight.current = null;
        });
    },
    [classify, live],
  );

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      const now = Date.now();
      const c = corners.value;
      if (!live.value || !c || now - lastAt.value < INTERVAL_MS) {
        frame.dispose();
        return;
      }
      const handled = asyncRunner.runAsync(() => {
        'worklet';
        try {
          const a = frame.convertCameraPointToFramePoint(c[0]);
          const b = frame.convertCameraPointToFramePoint(c[1]);
          const crop = HybridFrameConverter.convertFrameToImage(frame)
            .crop(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y))
            .rotate(uprightDegrees(frame.orientation))
            .resize(SIZE, SIZE);
          const raw = crop.toRawPixelData();
          scheduleOnRN(onPixels, toRgb(raw.buffer, raw.pixelFormat));
        } catch {
          // A frame that can't be converted is skipped; the next one is half a second away.
        } finally {
          frame.dispose();
        }
      });
      if (handled) lastAt.value = now;
      else frame.dispose();
    },
    [asyncRunner, corners, lastAt, live, onPixels],
  );
  // Skipped frames are the plan (one guess per INTERVAL_MS), not worth a warning each.
  const frameOutput = useFrameOutput({ pixelFormat: 'rgb', onFrame, onFrameDropped: () => undefined });

  /** Resolves once no live guess is running, so the model is free for the photo. */
  const idle = useCallback(() => inflight.current ?? Promise.resolve(), []);

  return { frameOutput, guess, onPreviewStarted, idle };
}

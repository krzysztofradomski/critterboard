/**
 * Downscale a captured/picked photo before it's handed to a classifier.
 *
 * Phone cameras and gallery photos routinely run 3000–4000px on the long
 * edge; neither the on-device model nor Gemini need anywhere near that for
 * insect ID, so shipping the raw file wastes upload bandwidth, Gemini
 * tokens, and time on the "analyzing" screen for zero accuracy gain. The
 * resized URI is also what gets stored as `lastPhotoUri` and shown on the
 * Result screen, so there's only ever one file on disk per scan.
 */

import * as ImageManipulator from 'expo-image-manipulator';

/** Long-edge cap in pixels. Comfortably above what any classifier needs. */
const MAX_DIMENSION = 1024;

/**
 * Returns a resized/re-encoded copy of `uri`. Falls back to the original
 * URI if manipulation fails for any reason (e.g. an already-deleted temp
 * file) so a prep failure never blocks a scan.
 */
export async function prepareForClassification(uri: string): Promise<string> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MAX_DIMENSION } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return uri;
  }
}

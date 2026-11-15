import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { photoFileUri } from '@/lib/photos';

/** Bound upload size and re-encode without original EXIF/GPS metadata. Called only after a search tap. */
export async function prepareSearchPhoto(uri: string, base64: boolean) {
  const source = ImageManipulator.manipulate(photoFileUri(uri));
  let image: Awaited<ReturnType<typeof source.renderAsync>> | undefined;
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
  let output: typeof image;
  try {
    image = await source.renderAsync();
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    context = ImageManipulator.manipulate(image);
    if (scale < 1) context.resize({ width: Math.max(1, Math.round(image.width * scale)), height: Math.max(1, Math.round(image.height * scale)) });
    output = await context.renderAsync();
    return await output.saveAsync({ compress: 0.85, format: SaveFormat.JPEG, base64 });
  } finally {
    output?.release();
    context?.release();
    image?.release();
    source.release();
  }
}

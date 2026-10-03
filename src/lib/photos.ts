import * as FileSystem from 'expo-file-system/legacy';

/**
 * Catch photos. The camera and the photo picker write to the cache folder, which the OS may
 * empty at any time, so a caught bug's photo is copied into documents when it is caught.
 */
const PHOTO_DIR = 'photos/';

/** Copy a photo into documents/photos/. Returns the kept URI, or the original if copying fails. */
export async function keepPhoto(uri: string): Promise<string> {
  const doc = FileSystem.documentDirectory;
  if (!doc || uri.startsWith(doc)) return uri;
  try {
    await FileSystem.makeDirectoryAsync(doc + PHOTO_DIR, { intermediates: true });
    const to = `${doc}${PHOTO_DIR}${Date.now()}-${uri.split('/').pop() || 'photo.jpg'}`;
    await FileSystem.copyAsync({ from: uri, to });
    return to;
  } catch {
    return uri;
  }
}

/**
 * Where a stored photo URI is today. iOS can move the app's container (update, reinstall), which
 * breaks absolute paths saved earlier, so a kept photo is re-rooted onto today's documents folder.
 */
export function photoFileUri(uri: string, doc: string | null = FileSystem.documentDirectory): string {
  if (!doc) return uri;
  // ".../Documents/" on iOS, ".../files/" on Android: the folder name before photos/.
  const marker = `/${doc.split('/').filter(Boolean).pop()}/${PHOTO_DIR}`;
  const at = uri.indexOf(marker);
  return at < 0 ? uri : doc + PHOTO_DIR + uri.slice(at + marker.length);
}

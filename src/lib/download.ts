import * as FileSystem from 'expo-file-system/legacy';

/** What a downloaded file must be, as pinned in the pack JSON (or in code for the chat model). */
export type Expected = { bytes?: number; md5?: string };

export type DownloadOpts = {
  expect?: Expected;
  /** Format check on the finished file (e.g. a complete PMTiles archive). */
  verify?: (path: string) => Promise<boolean>;
  onProgress?: (pct: number) => void;
  /** The running download, for callers that can cancel it (`pauseAsync`). */
  onStart?: (dl: FileSystem.DownloadResumable) => void;
};

/**
 * Download to `dest` without ever leaving a bad file there. The bytes go to `dest.part`,
 * which must answer 2xx, match the expected size and MD5 and pass `verify`; only then does
 * it replace `dest`. A failed, cancelled or interrupted download throws and leaves whatever
 * `dest` held before (a working model stays working).
 *
 * ponytail: MD5 because it is the only digest expo-file-system computes natively; SHA-256
 * would mean reading 100 MB–3 GB into JS. It catches corruption and truncation. Tampering is
 * covered by HTTPS plus URLs that can't change under us (a pinned Hugging Face commit, our
 * own repo for packs). Move to SHA-256 if a native streaming digest becomes available.
 */
export async function downloadFile(url: string, dest: string, opts: DownloadOpts = {}): Promise<void> {
  if (!url.startsWith('https://') && !__DEV__) throw new Error(`Refusing a non-HTTPS download: ${url}`);
  const part = `${dest}.part`;
  const dl = FileSystem.createDownloadResumable(url, part, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    if (totalBytesExpectedToWrite > 0) opts.onProgress?.(Math.floor((totalBytesWritten / totalBytesExpectedToWrite) * 100));
  });
  opts.onStart?.(dl);
  try {
    const res = await dl.downloadAsync();
    if (!res) throw new Error('Download cancelled');
    if (res.status < 200 || res.status >= 300) throw new Error(`Download failed (HTTP ${res.status})`);
    const { bytes, md5 } = opts.expect ?? {};
    const info = await FileSystem.getInfoAsync(part, { md5: !!md5 });
    if (!info.exists) throw new Error('Download produced no file');
    if (bytes !== undefined && info.size !== bytes) throw new Error(`Download is ${info.size} bytes, expected ${bytes}`);
    if (md5 && info.md5?.toLowerCase() !== md5.toLowerCase()) throw new Error('Download checksum mismatch');
    if (opts.verify && !(await opts.verify(part))) throw new Error('Downloaded file is not valid');
  } catch (e) {
    await FileSystem.deleteAsync(part, { idempotent: true }).catch(() => undefined);
    throw e;
  }
  await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.moveAsync({ from: part, to: dest });
}

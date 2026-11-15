/** Re-encode locally without EXIF/GPS or intermediate blob URLs retained by the web image manipulator. */
export async function prepareSearchPhoto(uri: string, base64: boolean) {
  if (!uri.startsWith('blob:') && !uri.startsWith('data:image/')) throw new Error('Photo unavailable');
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Photo unavailable');
  const image = await createImageBitmap(await response.blob());
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    return { uri: data, width: canvas.width, height: canvas.height, ...(base64 ? { base64: data.slice(data.indexOf(',') + 1) } : {}) };
  } finally {
    image.close();
  }
}

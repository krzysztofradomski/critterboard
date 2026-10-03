import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';

import { photoFileUri } from '@/lib/photos';

/**
 * A catch's photo filling its parent, or `fallback` when there is none or the file is gone
 * (the OS emptied the cache it was in, or the user cleared scan photos).
 */
export function CatchPhoto({ uri, fallback }: { uri?: string | null; fallback: React.ReactNode }) {
  const src = uri ? photoFileUri(uri) : null;
  const [failed, setFailed] = useState<string | null>(null);
  if (!src || failed === src) return <>{fallback}</>;
  return (
    <Image
      source={{ uri: src }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={() => setFailed(src)}
    />
  );
}

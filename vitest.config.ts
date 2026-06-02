import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: 'false',
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});

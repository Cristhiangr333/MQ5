import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // src/lib/lib.test.ts usa node:test (se corre con `node --test`), no vitest.
    include: ['src/**/*.test.tsx'],
  },
});

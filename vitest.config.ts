import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@pe/shared': resolve(here, 'packages/shared/src/index.ts'),
      '@pe/validation': resolve(here, 'packages/validation/src/index.ts'),
    },
    // Map the workspace packages' explicit `.js` specifiers back to `.ts`.
    extensions: ['.ts', '.tsx', '.js', '.mjs', '.json'],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: (globalThis as any).process?.env?.GITHUB_PAGES ? '/make-it-in-china/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        preview: 'preview.html',
      },
    },
  },
  test: {
    environment: 'node',
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit/**/*.{test,spec}.{js,ts}', 'tests/performance/**/*.{test,spec}.{js,ts}'],
    exclude: [
      'node_modules', 
      'dist'
    ],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/']
    }
  },
  resolve: {
    alias: {
      '@': __dirname
    }
  }
});

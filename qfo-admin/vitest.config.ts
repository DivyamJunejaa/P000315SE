import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    globals: true,
    coverage: {
      reporter: ['text', 'html'],
      provider: 'v8',
      thresholds: {
        lines: 75,
      },
      exclude: [
        'src/pages/**',
        'src/features/admin/hooks/**',
      ],
    },
  },
});
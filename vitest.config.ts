import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // A concrete origin so localStorage/sessionStorage don't throw
    // SecurityError under jsdom's default opaque origin.
    environmentOptions: { jsdom: { url: 'http://localhost:5001/' } },
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Component tests only — exclude e2e/build artifacts.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});

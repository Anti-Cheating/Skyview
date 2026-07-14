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
    setupFiles: ['./tests/setup.ts'],
    css: false,
    // Tests live under tests/, mirroring the src/ tree.
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        // Type-only modules — no runtime statements to cover.
        'src/types/**',
        'src/**/*.types.ts',
        // Static mock/demo data — scaffolding, not production logic.
        'src/mockData/**',
      ],
    },
  },
});

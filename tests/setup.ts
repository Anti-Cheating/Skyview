import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Unmount React trees + reset mocks between tests.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// This jsdom build gates Web Storage behind a file path — provide a
// simple in-memory localStorage/sessionStorage instead.
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() { return m.size; },
  } as Storage;
}
Object.defineProperty(window, 'localStorage', { value: memoryStorage(), writable: true });
Object.defineProperty(window, 'sessionStorage', { value: memoryStorage(), writable: true });

// jsdom doesn't implement matchMedia — MUI reads it. Stub a no-op.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }),
});

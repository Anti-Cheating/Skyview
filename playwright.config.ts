import { defineConfig, devices } from '@playwright/test';

/**
 * Skyview E2E suite — drives the live dev stack:
 *   - Skyview on :5001 (vite)
 *   - Cortex on :4000 (host or container)
 *   - cortex-postgres on :5432
 * Specs intentionally LEAVE data in the DB so you can browse it in Skyview
 * after the run. No cleanup between specs, no DB reset.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/sdk/**', '**/.state/**'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Specs intentionally share state via e2e/.state/run.json, so they must run
  // sequentially in numeric filename order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5001',
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

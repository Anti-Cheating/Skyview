/**
 * V2 BYO-DB migrate.
 *
 * Requires run-e2e.sh to have brought up `cortex-byodb-test` on :5434 with
 * a fresh empty postgres database. We point Skyview's Settings → Database
 * page at it, click Test connection, then Migrate. Then we re-check the
 * SuperAdmin company detail to confirm the chip flips to "Self-hosted".
 *
 * Cortex needs to be able to reach :5434 — which it can if it's running on
 * the host (env CORTEX_HOST_MODE=1) or if the container is on the host
 * network. The migration call goes Cortex → connect-string. Note we use
 * "host.docker.internal" to be safe when Cortex runs inside Docker.
 */
import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';
import { readState } from './helpers/state';

// cortex-byodb-test is started on the same Docker network as cortex-app,
// so Cortex reaches it by container name on port 5432 (the in-container
// port — the 5434 host-mapping is only for local dev tools).
const BYO_DB_URL_DOCKER   = 'postgresql://byo:byo@cortex-byodb-test:5432/byo';
const BYO_DB_URL_HOST     = 'postgresql://byo:byo@host.docker.internal:5434/byo';
const BYO_DB_URL_LOCALHOST = 'postgresql://byo:byo@localhost:5434/byo';

test.describe.serial('V2 BYO-DB migrate', () => {
  test('Test connection + run migrate', async ({ page }) => {
    const s = readState();
    await loginViaUi(page, s.owner.email, s.owner.password);
    await page.goto('/settings/database');

    // Skip the UI form: hit the test-connection endpoint directly from the
    // page so we get a clean structured response. (The form's controlled-
    // state + alert-replacement timing has been flaky here.)
    const probe = await page.evaluate(async (urls) => {
      const accessToken = localStorage.getItem('auth_access_token') ?? '';
      const out: Record<string, any> = {};
      for (const u of urls) {
        const r = await fetch('http://localhost:4000/api/companies/me/database/test-connection', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'content-type': 'application/json',
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ db_url: u }),
        });
        out[u] = { status: r.status, body: await r.text() };
      }
      return out;
    }, [BYO_DB_URL_DOCKER, BYO_DB_URL_HOST, BYO_DB_URL_LOCALHOST]);
    console.log('[v2-migrate] test-connection probes:', JSON.stringify(probe, null, 2));

    const dockerOk = probe[BYO_DB_URL_DOCKER].status === 200 &&
      JSON.parse(probe[BYO_DB_URL_DOCKER].body).ok === true;
    expect(dockerOk, JSON.stringify(probe)).toBeTruthy();

    // Fill the form with the working URL so the Migrate button enables.
    const urlField = page.getByLabel(/postgres url/i);
    await urlField.fill(BYO_DB_URL_DOCKER);
    await page.getByRole('button', { name: /test connection/i }).click();
    await expect(page.locator('.MuiAlert-standardSuccess')).toBeVisible({ timeout: 8000 });

    // Migrate
    await page.getByRole('button', { name: /^migrate$/i }).click();
    // Migrate may run for a while; wait for the success Alert.
    await expect(page.locator('.MuiAlert-standardSuccess')).toBeVisible({ timeout: 60_000 });
  });

  test('SuperAdmin sees company flip to Self-hosted', async ({ page }) => {
    const s = readState();
    await loginViaUi(page, 'admin@trueyy.com', 'admin@1234');
    await page.goto(`/admin/tenants/${s.owner.companyId}`);
    await expect(page.getByText(/self-hosted/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

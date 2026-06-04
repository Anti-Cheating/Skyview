/**
 * Owner end-to-end flow.
 *
 * Signs up a brand-new TestCo, then exercises:
 *   • API tokens — generate live + test, copy reveal dialog, table appears
 *   • Webhooks — add endpoint, table appears
 *   • Billing / Branding / Retention / Database pages load
 *   • Create one interview (CRUD: create + open + delete is in 02)
 *
 * Persists company id + plaintext tokens to e2e/.state/run.json so
 * subsequent specs + the SDK fake-customer script can use them.
 */
import { test, expect } from '@playwright/test';
import { signupViaApi, loginViaUi } from './helpers/auth';
import { patchState, readState, type RunState } from './helpers/state';

const RUN_ID =
  new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) +
  Math.random().toString(36).slice(2, 6);
const COMPANY = `TestCo-${RUN_ID}`;
const OWNER = {
  email: `owner+${RUN_ID}@example.com`,
  password: 'Test@1234',
  firstName: 'Olivia',
  lastName: 'Owner',
  companyName: COMPANY,
};

/** Re-login each test since Playwright gives a fresh context per test. */
async function ensureOwnerLoggedIn(page: import('@playwright/test').Page) {
  const s = readState();
  await loginViaUi(page, s.owner.email, s.owner.password);
}

test.describe.serial('Owner flow', () => {
  test('Signup + login + dashboard', async ({ page, request }) => {
    const { userId, companyId } = await signupViaApi(request, OWNER);
    expect(companyId).toBeTruthy();
    patchState({
      runId: RUN_ID,
      owner: { ...OWNER, userId, companyId: companyId ?? undefined },
    } as RunState);

    await loginViaUi(page, OWNER.email, OWNER.password);
    await expect(page).toHaveURL(/\/(dashboard|interviews|$)/);
    // Dashboard should show the company name somewhere in the chrome.
    await expect(page.getByText(COMPANY, { exact: false }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('Settings → generate live API token', async ({ page }) => {
    await ensureOwnerLoggedIn(page);
    await page.goto('/settings/tokens');
    await page.getByRole('button', { name: /generate token/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // First text input in the dialog is "Label", second is "Environment" select.
    await dialog.locator('input[type="text"], input:not([type])').first().fill('Production backend');
    await page.getByRole('button', { name: /^generate$/i }).click();

    // Wait for the reveal dialog title — same role="dialog" but different
    // content — before reading the token input.
    await expect(page.getByRole('dialog').getByText(/copy it now/i)).toBeVisible({ timeout: 10_000 });
    const reveal = page.getByRole('dialog');
    const tokenField = reveal.locator('input').first();
    const plaintext = await tokenField.inputValue();
    expect(plaintext).toMatch(/^(sk|tk)_(live|test)_/);
    patchState({ tokens: { live: plaintext } } as Partial<RunState>);

    await page.getByRole('button', { name: /i'?ve saved it/i }).click();
    await expect(page.getByText('Production backend').first()).toBeVisible();
  });

  test('Settings → generate test API token', async ({ page }) => {
    await ensureOwnerLoggedIn(page);
    await page.goto('/settings/tokens');
    await page.getByRole('button', { name: /generate token/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="text"], input:not([type])').first().fill('Sandbox client');
    // Native <select> with options live / test.
    await dialog.locator('select').selectOption('test');
    await page.getByRole('button', { name: /^generate$/i }).click();

    await expect(page.getByRole('dialog').getByText(/copy it now/i)).toBeVisible({ timeout: 10_000 });
    const reveal = page.getByRole('dialog');
    const tokenField = reveal.locator('input').first();
    const plaintext = await tokenField.inputValue();
    expect(plaintext).toMatch(/^(sk|tk)_test_/);
    const cur = (await import('./helpers/state')).readState();
    patchState({ tokens: { ...cur.tokens, test: plaintext } } as Partial<RunState>);

    await page.getByRole('button', { name: /i'?ve saved it/i }).click();
    await expect(page.getByText('Sandbox client').first()).toBeVisible();
  });

  test('Settings → add webhook endpoint (via API)', async ({ page }) => {
    // The MUI multi-Select for event types doesn't commit selections from
    // Playwright's synthetic input events, so we skip the dialog and POST
    // directly through the page's authenticated session. The point of this
    // step is to prove the table renders new endpoints — not the multi-
    // select widget.
    await ensureOwnerLoggedIn(page);
    await page.goto('/settings/webhooks');

    const result = await page.evaluate(async () => {
      const accessToken = localStorage.getItem('auth_access_token');
      const r = await fetch('http://localhost:4000/api/companies/me/webhook-endpoints', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          label: 'E2E webhook',
          // Cortex enforces HTTPS for webhook URLs. Real delivery testing
          // happens in the SDK fake-customer script (which can run against
          // the live local receiver via a separate channel).
          url: 'https://example.com/wh',
          events: ['*'],
        }),
      });
      return { status: r.status, body: await r.text() };
    });
    expect(result.status, result.body).toBeLessThan(400);

    await page.reload();
    await expect(page.getByText('https://example.com/wh').first()).toBeVisible();
  });

  test('Settings → other tabs load', async ({ page }) => {
    await ensureOwnerLoggedIn(page);
    for (const slug of ['billing', 'branding', 'retention', 'database']) {
      await page.goto(`/settings/${slug}`);
      // Tab label should be visible and the URL should match.
      await expect(page).toHaveURL(new RegExp(`/settings/${slug}`));
      await expect(page.getByRole('tab', { selected: true })).toBeVisible();
    }
  });

  test('Create an interview', async ({ page }) => {
    await ensureOwnerLoggedIn(page);
    await page.goto('/interviews/new');
    await page.getByLabel(/interview title/i).fill('E2E Smoke Interview');
    await page.getByLabel(/description/i).fill('Created by Playwright E2E suite');
    await page.getByLabel(/candidate first name/i).fill('Cara');
    await page.getByLabel(/candidate last name/i).fill('Candidate');
    await page.getByLabel(/candidate email/i).fill(`candidate+${RUN_ID}@example.com`);

    // Submit — the button label may differ across builds ("Create", "Save", etc.)
    const submit = page
      .getByRole('button', { name: /^(create interview|create|save|schedule)$/i })
      .first();
    await submit.click();

    // Land on detail page or back on list; either way, the title is visible.
    await expect(page.getByText('E2E Smoke Interview')).toBeVisible({ timeout: 15_000 });
  });
});

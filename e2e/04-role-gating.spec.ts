/**
 * Role gating — Member should NOT see Users/Settings/Companies; Admin should
 * see Users + Settings but NOT Companies; manually navigating to gated paths
 * should redirect.
 */
import { test, expect } from '@playwright/test';
import { loginViaUi, logoutViaUi } from './helpers/auth';
import { readState } from './helpers/state';

test.describe.serial('Role gating', () => {
  test('Member cannot see manager nav items', async ({ page }) => {
    const s = readState();
    if (!s.member) test.skip(true, 'member not provisioned');
    await loginViaUi(page, s.member!.email, s.member!.password);

    const nav = page.locator('nav, aside');
    await expect(nav.getByRole('link', { name: /users/i })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /settings/i })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /companies/i })).toHaveCount(0);

    // Direct navigation to /users redirects to root.
    await page.goto('/users');
    await expect(page).not.toHaveURL(/\/users\b/);
    await page.goto('/settings/tokens');
    await expect(page).not.toHaveURL(/\/settings\b/);
    await logoutViaUi(page);
  });

  test('Admin sees Users + Settings, not Companies', async ({ page }) => {
    const s = readState();
    if (!s.admin) test.skip(true, 'admin not provisioned');
    await loginViaUi(page, s.admin!.email, s.admin!.password);

    const nav = page.locator('nav, aside');
    await expect(nav.getByRole('link', { name: /users/i }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /settings/i }).first()).toBeVisible();
    await expect(nav.getByRole('link', { name: /companies/i })).toHaveCount(0);
    await logoutViaUi(page);
  });
});

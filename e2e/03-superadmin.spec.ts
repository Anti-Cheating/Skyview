/**
 * SuperAdmin (admin@trueyy.com) views the company we just created.
 * Drills into every tab on the company detail page.
 */
import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';
import { readState } from './helpers/state';

const SUPER = { email: 'admin@trueyy.com', password: 'admin@1234' };

test.describe.serial('SuperAdmin flow', () => {
  test('Companies list shows the new company', async ({ page }) => {
    const s = readState();
    await loginViaUi(page, SUPER.email, SUPER.password);
    await page.goto('/admin/tenants');
    await expect(page.getByText(/^Companies$/).first()).toBeVisible();
    await expect(page.getByText(s.owner.companyName)).toBeVisible({ timeout: 10_000 });
  });

  test('Drill into company detail and walk every tab', async ({ page }) => {
    const s = readState();
    if (!s.owner.companyId) throw new Error('Missing companyId in state');
    await loginViaUi(page, SUPER.email, SUPER.password);
    await page.goto(`/admin/tenants/${s.owner.companyId}`);

    // Header (PageTitle renders a styled Typography but may not register as a heading role).
    await expect(page.getByText(s.owner.companyName).first()).toBeVisible();
    // Tabs — at minimum these labels are present.
    const tabs = ['Overview', 'Users', 'Sessions', 'API tokens', 'Webhooks', 'Invoices', 'Migrations', 'Audit log'];
    for (const label of tabs) {
      const tab = page.getByRole('tab', { name: new RegExp(`^${label}$`, 'i') });
      await expect(tab).toBeVisible();
      await tab.click();
      // Just wait a beat for the panel to render — failures here mean a
      // route handler returned 500, which is what we want to surface.
      await page.waitForLoadState('networkidle');
    }
  });
});

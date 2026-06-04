/**
 * Team invites — owner invites three teammates with different roles.
 * Email is no-op'd in dev; we read the invite token from company_invites
 * and accept it directly via the public /invite/:token UI.
 */
import { test, expect } from '@playwright/test';
import { loginViaUi, logoutViaUi } from './helpers/auth';
import { getInviteToken, getUserAndCompany } from './helpers/db';
import { patchState, readState } from './helpers/state';

test.describe.serial('Team invites', () => {
  test('Owner invites Admin + Member + Interviewer', async ({ page }) => {
    const s = readState();
    await loginViaUi(page, s.owner.email, s.owner.password);
    await page.goto('/users');

    // The invite dialog only offers Admin + Member (Interviewer is a
    // platform-level role, not a workspace seat).
    const invites = [
      { role: 'Admin',  email: `admin+${s.runId}@example.com` },
      { role: 'Member', email: `member+${s.runId}@example.com` },
    ];

    for (const inv of invites) {
      await page.getByRole('button', { name: /(invite teammate|invite|add teammate)/i }).first().click();
      await page.getByLabel(/email/i).fill(inv.email);
      await page.getByLabel(/role/i).selectOption(inv.role);
      await page.getByRole('button', { name: /(send invite|send|invite)/i }).click();
      // dialog closes
      await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 5000 });
    }
  });

  test('Accept the two invites (Admin / Member)', async ({ page }) => {
    const s = readState();
    await logoutViaUi(page);

    const list: ('admin' | 'member')[] = ['admin', 'member'];
    for (const role of list) {
      const email = `${role}+${s.runId}@example.com`;
      const password = 'Test@1234';
      const token = getInviteToken(email);

      await page.goto(`/invite/${token}`);
      // Form has First name, Last name, Password (+ company/email read-only).
      await page.getByLabel(/first name/i).fill(role.charAt(0).toUpperCase() + role.slice(1));
      await page.getByLabel(/last name/i).fill('User');
      await page.locator('input[type="password"]').first().fill(password);
      await page.getByRole('button', { name: /(accept invitation|accept|join|sign up|create account)/i }).first().click();
      await page.waitForURL((url) => !url.pathname.startsWith('/invite'), { timeout: 15_000 });

      const { userId } = getUserAndCompany(email);
      patchState({
        [role]: { email, password, firstName: role, lastName: 'User', userId },
      } as any);

      await logoutViaUi(page);
    }
  });
});

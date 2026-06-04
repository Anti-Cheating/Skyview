/**
 * Auth helpers — drive the real login + signup forms so the UI is exercised.
 *
 * Signup flow:
 *   POST /auth/signup → user created, requires verification
 *   → SQL UPDATE email_verified_at = NOW() (email is no-op'd in dev)
 *   → POST /auth/login via the UI form
 */
import type { Page, APIRequestContext } from '@playwright/test';
import { verifyUserEmail, getUserAndCompany } from './db';
import type { UserCreds } from './state';

const CORTEX = 'http://localhost:4000';

export interface SignupResult {
  userId: string;
  companyId: string | null;
}

export async function signupViaApi(
  request: APIRequestContext,
  creds: UserCreds & { companyName?: string },
): Promise<SignupResult> {
  const payload: Record<string, string> = {
    email: creds.email,
    password: creds.password,
    firstName: creds.firstName,
    lastName: creds.lastName,
  };
  if (creds.companyName) payload.companyName = creds.companyName;

  const res = await request.post(`${CORTEX}/auth/signup`, { data: payload });
  if (!res.ok()) {
    throw new Error(`signup failed: ${res.status()} ${await res.text()}`);
  }
  verifyUserEmail(creds.email);
  const { userId, companyId } = getUserAndCompany(creds.email);
  return { userId, companyId };
}

export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('input[type="email"], input[name="email"], input[autocomplete="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /^(sign in|log in)$/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

export async function logoutViaUi(page: Page): Promise<void> {
  // Make sure we're on a same-origin page before touching storage.
  if (!page.url().startsWith('http://localhost:5001')) {
    await page.goto('/');
  }
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  });
  await page.context().clearCookies();
  await page.goto('/login');
}

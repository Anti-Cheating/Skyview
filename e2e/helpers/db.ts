/**
 * Direct DB helpers — only used to:
 *   1. Force-verify a freshly-signed-up user (email is no-op'd in dev so
 *      we patch email_verified_at directly instead of clicking a link).
 *   2. Read company_id / user_id for accounts the UI just created.
 *
 * Runs `psql` inside the cortex-postgres container.
 */
import { execFileSync } from 'node:child_process';

function psql(sql: string): string {
  const out = execFileSync(
    'docker',
    [
      'exec', 'cortex-postgres',
      'psql', '-U', 'postgres', '-d', 'cortex',
      '-A', '-t',         // unaligned, tuples-only
      '-F', '|',          // field separator
      '-c', sql,
    ],
    { encoding: 'utf8' },
  );
  return out.trim();
}

export function verifyUserEmail(email: string): void {
  psql(`UPDATE users SET email_verified_at = NOW() WHERE email = '${email.replace(/'/g, "''")}';`);
}

export function getUserAndCompany(email: string): { userId: string; companyId: string | null } {
  const safe = email.replace(/'/g, "''");
  const row = psql(`SELECT id, company_id FROM users WHERE email = '${safe}' LIMIT 1;`);
  if (!row) throw new Error(`No user found for ${email}`);
  const [userId, companyId] = row.split('|');
  return { userId: userId!.trim(), companyId: companyId?.trim() || null };
}

export function getInviteToken(email: string): string {
  const safe = email.replace(/'/g, "''");
  const row = psql(
    `SELECT token FROM company_invites WHERE email = '${safe}' ORDER BY created_at DESC LIMIT 1;`,
  );
  if (!row) throw new Error(`No invite token for ${email}`);
  return row.trim();
}

export function countRowsForCompany(table: string, companyId: string): number {
  const safe = companyId.replace(/'/g, "''");
  const out = psql(`SELECT COUNT(*) FROM ${table} WHERE company_id = '${safe}';`);
  return Number(out);
}

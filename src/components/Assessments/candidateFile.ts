import type { InviteCandidate } from '../../types/assessment.types';

export const EMAIL_RE = /^[^\s@<>,;"']+@[^\s@<>,;"']+\.[^\s@<>,;"']+$/;

/** Minimal RFC 4180 CSV: commas or semicolons, quoted fields, "" escapes. */
export function parseCsv(text: string): string[][] {
  const delim = (text.split('\n')[0] ?? '').split(';').length > (text.split('\n')[0] ?? '').split(',').length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Spreadsheet rows → candidates. Uses a header row when there is one
 * (email / first name / last name / name, in any order); otherwise takes the
 * email from whichever cell looks like one. Rows without a valid email are
 * returned in `invalid` (1-based row numbers) so the page can say which.
 */
export function rowsToCandidates(rows: unknown[][]): { candidates: InviteCandidate[]; invalid: number[] } {
  const cells = rows.map((r) => r.map((c) => (c == null ? '' : String(c).trim())));
  const header = cells[0]?.map(norm) ?? [];
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const emailCol = col('email', 'emailaddress', 'mail', 'emailid');
  const hasHeader = emailCol >= 0;
  const firstCol = hasHeader ? col('firstname', 'first', 'givenname') : -1;
  const lastCol = hasHeader ? col('lastname', 'last', 'surname', 'familyname') : -1;
  const nameCol = hasHeader ? col('name', 'fullname', 'candidatename', 'candidate') : -1;

  const candidates: InviteCandidate[] = [];
  const invalid: number[] = [];
  const seen = new Set<string>();
  cells.forEach((r, i) => {
    if (hasHeader && i === 0) return;
    const email = (hasHeader ? r[emailCol] : r.find((c) => EMAIL_RE.test(c))) ?? '';
    if (!EMAIL_RE.test(email)) { invalid.push(i + 1); return; }
    const key = email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    let first = firstCol >= 0 ? r[firstCol] : '';
    let last = lastCol >= 0 ? r[lastCol] : '';
    if (!first && !last && nameCol >= 0 && r[nameCol]) {
      const [f, ...rest] = r[nameCol].split(/\s+/);
      first = f ?? '';
      last = rest.join(' ');
    }
    candidates.push({ email, ...(first && { first_name: first }), ...(last && { last_name: last }) });
  });
  return { candidates, invalid };
}

/** Read a .csv or .xlsx file into candidates (first sheet for Excel). */
export async function readCandidateFile(file: File): Promise<{ candidates: InviteCandidate[]; invalid: number[] }> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    return rowsToCandidates(await readSheet(file));
  }
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return rowsToCandidates(parseCsv(await file.text()));
  throw new Error('Upload a .csv or .xlsx file');
}

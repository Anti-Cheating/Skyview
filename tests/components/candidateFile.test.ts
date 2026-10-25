import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToCandidates } from '../../src/components/Assessments/candidateFile';

describe('candidate file parsing', () => {
  it('reads a CSV with a header in any column order, quotes and duplicates', () => {
    const csv = 'Name,Email\n"Mehta, Rahul",rahul@example.com\nAsha Rao,asha@example.com\nnobody,not-an-email\nASHA@example.com Dup,asha@example.com\n';
    const rows = parseCsv(csv);
    expect(rows[1]).toEqual(['Mehta, Rahul', 'rahul@example.com']);
    expect(rowsToCandidates(rows)).toEqual({
      candidates: [
        { email: 'rahul@example.com', first_name: 'Mehta,', last_name: 'Rahul' },
        { email: 'asha@example.com', first_name: 'Asha', last_name: 'Rao' },
      ],
      invalid: [4],
    });
  });

  it('uses first/last name columns, semicolons, and Excel-style values', () => {
    expect(rowsToCandidates(parseCsv('first name;last name;e-mail\nPriya;Shah;priya@example.com'))).toEqual({
      candidates: [{ email: 'priya@example.com', first_name: 'Priya', last_name: 'Shah' }],
      invalid: [],
    });
    // No header: the email is found in whichever cell looks like one (Excel rows may hold numbers / nulls).
    expect(rowsToCandidates([[1, 'Dev', 'dev@example.com', null]]).candidates).toEqual([{ email: 'dev@example.com' }]);
  });
});

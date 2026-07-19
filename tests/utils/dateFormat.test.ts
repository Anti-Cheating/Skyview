import { describe, test, expect } from 'vitest';
import { formatDateTime, formatClock } from '../../src/utils/dateFormat';

const DATE = new Date('2026-01-15T14:32:45');

describe('formatDateTime', () => {
  test('formats a full date + time with seconds by default', () => {
    const out = formatDateTime(DATE);
    expect(out).toContain('Jan');
    expect(out).toContain('15');
    expect(out).toContain('2026');
    expect(out).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(out).toMatch(/[AP]M/);
  });

  test('omits seconds when { seconds: false }', () => {
    const out = formatDateTime(DATE, { seconds: false });
    expect(out).toMatch(/\d{1,2}:\d{2}\s?[AP]M/);
    expect(out).not.toMatch(/:\d{2}:\d{2}/);
  });

  test('accepts string and number inputs', () => {
    expect(formatDateTime(DATE.toISOString())).toContain('2026');
    expect(formatDateTime(DATE.getTime())).toContain('2026');
  });

  test('returns "" on invalid input', () => {
    expect(formatDateTime('not-a-date')).toBe('');
    expect(formatDateTime(NaN)).toBe('');
  });
});

describe('formatClock', () => {
  test('time only, with and without seconds', () => {
    expect(formatClock(DATE)).toMatch(/\d{1,2}:\d{2}:\d{2}\s?[AP]M/);
    expect(formatClock(DATE, { seconds: false })).toMatch(/\d{1,2}:\d{2}\s?[AP]M/);
  });
  test('returns "" on invalid input', () => {
    expect(formatClock('nope')).toBe('');
  });
});

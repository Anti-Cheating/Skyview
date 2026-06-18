/**
 * Centralized date/time formatting for Skyview — the single source of
 * truth so every surface renders timestamps consistently.
 *
 * Convention: 12-hour clock, en-US locale, full date + time inline.
 * Replaces the per-component hand-rolled formatTime / formatOffset helpers
 * that had drifted apart (some included seconds, some showed an elapsed
 * "mm:ss" offset, some omitted the date entirely).
 *
 * - formatDateTime → "Jan 15, 2026, 2:32:45 PM"  (the default everywhere)
 * - formatClock    → "2:32:45 PM"                 (time only; for dense
 *                                                   visual aids like chart
 *                                                   axis ticks where the
 *                                                   full date won't fit)
 */

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

const DATETIME_NO_SECONDS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

const CLOCK_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
};

const CLOCK_NO_SECONDS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

function toDate(input: string | number | Date): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date + time: "Jan 15, 2026, 2:32:45 PM". Empty string on bad input. */
export function formatDateTime(
  input: string | number | Date,
  opts?: { seconds?: boolean }
): string {
  const d = toDate(input);
  if (!d) return "";
  return d.toLocaleString(
    "en-US",
    opts?.seconds === false ? DATETIME_NO_SECONDS : DATETIME_OPTS
  );
}

/** Time only: "2:32:45 PM". For chart axes / tight spaces. */
export function formatClock(
  input: string | number | Date,
  opts?: { seconds?: boolean }
): string {
  const d = toDate(input);
  if (!d) return "";
  return d.toLocaleTimeString(
    "en-US",
    opts?.seconds === false ? CLOCK_NO_SECONDS : CLOCK_OPTS
  );
}

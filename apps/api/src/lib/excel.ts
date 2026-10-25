/**
 * Spreadsheet safety helpers.
 *
 * Untrusted text (names, answers) must never be written to a cell in a way that
 * Excel would execute as a formula, and must not carry control characters that
 * break the file. Every value written to a worksheet or CSV passes through here.
 */

export type CellValue = string | number | null;

export function sanitizeCell(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  // Neutralise a leading formula trigger (also tab/CR) by prefixing an apostrophe.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text;
}

/** Quotes and escapes a single CSV field (RFC 4180) after sanitisation. */
export function csvCell(value: unknown): string {
  const safe = sanitizeCell(value);
  if (safe === null) return '';
  const text = String(safe);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Builds a UTF-8 CSV document with a BOM so Excel reads Persian correctly. */
export function buildCsv(rows: (unknown[])[]): string {
  const body = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return `\uFEFF${body}`;
}

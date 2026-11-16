import type ExcelJS from 'exceljs';

/**
 * Pure helpers shared by the spreadsheet importers.
 *
 * Kept free of Prisma/HTTP so they can be unit-tested directly — the parsing
 * rules (Persian digits, option syntax, stable keys) are where an import bug
 * would silently corrupt data.
 */

/** Converts Persian/Arabic-Indic digits to ASCII so `Number()` and regexes work. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/** Reads a cell as trimmed text, unwrapping rich-text and hyperlink cells. */
export function cellText(row: ExcelJS.Row, col: number): string {
  const value = row.getCell(col).value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'text' in value && typeof (value as { text?: unknown }).text === 'string') {
    return (value as { text: string }).text.trim();
  }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('').trim();
  }
  if (typeof value === 'object' && 'result' in value) {
    return String((value as { result?: unknown }).result ?? '').trim();
  }
  return String(value).trim();
}

export interface ParsedOption {
  label: string;
  value: string;
  score: number | null;
  isNotApplicable: boolean;
  sortOrder: number;
}

/**
 * `بسیار ضعیف=20 | متوسط=60 | عالی=100` → options. A part without `=score`
 * keeps a null score instead of being guessed (a wrong score is worse than a
 * missing one); `:` works as the separator too.
 */
export function parseOptionList(raw: string): ParsedOption[] {
  return raw
    .split(/[|؛;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const m = part.match(/^(.*?)\s*[=:]\s*(-?\d+(?:\.\d+)?)\s*$/);
      const label = (m?.[1] ?? part).trim();
      const score = m?.[2] ? Number(m[2]) : null;
      return { label, value: `opt_${index + 1}`, score, isNotApplicable: false, sortOrder: index };
    })
    .filter((o) => o.label.length > 0);
}

/**
 * A question's stable key must stay `[a-z0-9_]` for every historical version, so
 * a Persian title is transliterated into a legal key rather than rejected. The
 * result is shown in the preview before anything is written.
 */
export function normalizeStableKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[\s\-/\\]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

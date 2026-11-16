import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { cellText, normalizeDigits, normalizeStableKey, parseOptionList } from '../../apps/api/src/lib/spreadsheet.js';

/**
 * The parsing layer of the Excel imports. These assertions guard the rules that
 * would otherwise corrupt an import silently: Persian digits, the option
 * syntax, and stable keys.
 */
describe('spreadsheet helpers', () => {
  it('converts Persian and Arabic-Indic digits', () => {
    expect(normalizeDigits('۰۹۱۲۳۴۵۶۷۸۹')).toBe('09123456789');
    expect(normalizeDigits('٤٢')).toBe('42');
    expect(normalizeDigits('12')).toBe('12');
  });

  it('parses label=score options separated by a pipe', () => {
    const options = parseOptionList('بسیار ضعیف=20 | متوسط=60 | عالی=100');
    expect(options.map((o) => o.label)).toEqual(['بسیار ضعیف', 'متوسط', 'عالی']);
    expect(options.map((o) => o.score)).toEqual([20, 60, 100]);
    expect(options.map((o) => o.sortOrder)).toEqual([0, 1, 2]);
    expect(options[0]?.value).toBe('opt_1');
  });

  it('accepts a colon separator and keeps a missing score as null', () => {
    const options = parseOptionList('بله:100؛ خیر:0؛ نمی‌دانم');
    expect(options.map((o) => o.label)).toEqual(['بله', 'خیر', 'نمی‌دانم']);
    expect(options.map((o) => o.score)).toEqual([100, 0, null]);
  });

  it('drops empty option parts instead of creating blank choices', () => {
    expect(parseOptionList('  | الف=10 |  ')).toHaveLength(1);
    expect(parseOptionList('')).toHaveLength(0);
  });

  it('normalises a stable key to lowercase letters, digits and underscores', () => {
    expect(normalizeStableKey(' Quality Score / 2 ')).toBe('quality_score_2');
    expect(normalizeStableKey('team--work')).toBe('team_work');
    expect(normalizeStableKey('__lead__')).toBe('lead');
  });

  it('leaves no legal characters from a purely Persian key (preview reports it)', () => {
    expect(normalizeStableKey('کیفیت کار')).toBe('');
  });

  it('reads rich-text and formula cells as text', () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('t');
    const row = sheet.addRow(['plain', '']);
    row.getCell(2).value = { richText: [{ text: 'بخش' }, { text: ' دوم' }] };
    row.getCell(3).value = { formula: 'A1', result: 'computed' };
    expect(cellText(row, 1)).toBe('plain');
    expect(cellText(row, 2)).toBe('بخش دوم');
    expect(cellText(row, 3)).toBe('computed');
    expect(cellText(row, 4)).toBe('');
  });
});

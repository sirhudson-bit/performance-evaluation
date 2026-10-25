/**
 * Persian text normalisation.
 *
 * Arabic and Persian share a script but differ in a few codepoints (ي vs ی,
 * ك vs ک) and in optional zero-width characters. Normalising both sides before
 * comparison makes search tolerant of those variants. Used for in-memory
 * filtering (help search, suggestions); the database `contains` search is left
 * as-is because normalising stored data would require a generated column.
 */
export function normalizeFa(input: string): string {
  return input
    .replace(/[\u064A\u0649]/g, '\u06CC') // Arabic yeh -> Persian yeh
    .replace(/\u0643/g, '\u06A9') // Arabic kaf -> Persian kaf
    .replace(/\u0640/g, '') // tatweel
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // zero-width chars + ZWNJ
    .replace(/[\u064B-\u065F]/g, '') // Arabic diacritics
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** True when `haystack` contains `needle` after normalisation. */
export function faContains(haystack: string, needle: string): boolean {
  return normalizeFa(haystack).includes(normalizeFa(needle));
}

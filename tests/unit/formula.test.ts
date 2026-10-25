import { describe, it, expect } from 'vitest';
import { evaluateFormula, formulaVariables, validateFormula } from '../../packages/shared/src/formula';

describe('formula evaluator', () => {
  it('evaluates basic arithmetic with precedence', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
    expect(evaluateFormula('10 / 4', {})).toBe(2.5);
  });

  it('supports identifiers and weights', () => {
    expect(evaluateFormula('quality * 0.6 + teamwork * 0.4', { quality: 90, teamwork: 70 })).toBeCloseTo(82);
  });

  it('supports unary minus', () => {
    expect(evaluateFormula('-3 + 10', {})).toBe(7);
  });

  it('rejects division by zero', () => {
    expect(() => evaluateFormula('5 / 0', {})).toThrow();
  });

  it('rejects unknown variables', () => {
    expect(() => evaluateFormula('missing + 1', {})).toThrow();
  });

  it('rejects malformed expressions', () => {
    expect(() => evaluateFormula('2 +', {})).toThrow();
    expect(() => evaluateFormula('(2 + 3', {})).toThrow();
    expect(() => evaluateFormula('2 $ 3', {})).toThrow();
  });

  it('lists referenced variables and validates against known keys', () => {
    expect(formulaVariables('a * 2 + b').sort()).toEqual(['a', 'b']);
    expect(validateFormula('a * 2', ['a'])).toBeNull();
    expect(validateFormula('a * c', ['a'])).toContain('c');
  });
});

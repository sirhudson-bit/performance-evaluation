/**
 * Safe arithmetic evaluator for calculated (quantitative) indicators.
 *
 * Supports numbers, `+ - * /`, parentheses and identifiers bound to variables
 * (typically other questions' normalized scores). It is a small recursive-
 * descent parser — there is no `eval` and no way to execute arbitrary code, so an
 * administrator-authored expression cannot escape into the server.
 */

type Token = { type: 'num'; value: number } | { type: 'id'; value: string } | { type: 'op'; value: string };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < input.length && /[0-9.]/.test(input[i] as string)) {
        num += input[i];
        i += 1;
      }
      const value = Number(num);
      if (!Number.isFinite(value)) throw new Error(`عدد نامعتبر در فرمول: «${num}»`);
      tokens.push({ type: 'num', value });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i] as string)) {
        id += input[i];
        i += 1;
      }
      tokens.push({ type: 'id', value: id });
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    throw new Error(`نویسه نامعتبر در فرمول: «${ch}»`);
  }
  return tokens;
}

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[], private readonly vars: Record<string, number>) {}

  parse(): number {
    const value = this.expression();
    if (this.pos !== this.tokens.length) throw new Error('عبارت فرمول کامل نیست.');
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private expression(): number {
    let left = this.term();
    for (;;) {
      const token = this.peek();
      if (token?.type === 'op' && (token.value === '+' || token.value === '-')) {
        this.pos += 1;
        const right = this.term();
        left = token.value === '+' ? left + right : left - right;
      } else {
        return left;
      }
    }
  }

  private term(): number {
    let left = this.factor();
    for (;;) {
      const token = this.peek();
      if (token?.type === 'op' && (token.value === '*' || token.value === '/')) {
        this.pos += 1;
        const right = this.factor();
        if (token.value === '/') {
          if (right === 0) throw new Error('تقسیم بر صفر در فرمول.');
          left /= right;
        } else {
          left *= right;
        }
      } else {
        return left;
      }
    }
  }

  private factor(): number {
    const token = this.peek();
    if (!token) throw new Error('فرمول ناقص است.');
    if (token.type === 'op' && token.value === '(') {
      this.pos += 1;
      const value = this.expression();
      const close = this.peek();
      if (close?.type !== 'op' || close.value !== ')') throw new Error('پرانتز بسته نشده است.');
      this.pos += 1;
      return value;
    }
    if (token.type === 'op' && token.value === '-') {
      this.pos += 1;
      return -this.factor();
    }
    if (token.type === 'num') {
      this.pos += 1;
      return token.value;
    }
    if (token.type === 'id') {
      this.pos += 1;
      const value = this.vars[token.value];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`متغیر «${token.value}» مقدار عددی معتبر ندارد.`);
      }
      return value;
    }
    throw new Error('فرمول نامعتبر است.');
  }
}

/** Evaluates an expression. Throws with a Persian message on any problem. */
export function evaluateFormula(expression: string, vars: Record<string, number>): number {
  const trimmed = expression.trim();
  if (!trimmed) throw new Error('فرمول خالی است.');
  const value = new Parser(tokenize(trimmed), vars).parse();
  if (!Number.isFinite(value)) throw new Error('نتیجه فرمول عدد معتبر نیست.');
  return value;
}

/** Identifiers referenced by an expression (used to validate a formula). */
export function formulaVariables(expression: string): string[] {
  return tokenize(expression)
    .filter((t): t is { type: 'id'; value: string } => t.type === 'id')
    .map((t) => t.value);
}

/** Validates a formula against the set of known variable names. */
export function validateFormula(expression: string, knownKeys: string[]): string | null {
  try {
    for (const name of formulaVariables(expression)) {
      if (!knownKeys.includes(name)) return `متغیر ناشناخته در فرمول: «${name}»`;
    }
    evaluateFormula(expression, Object.fromEntries(knownKeys.map((k) => [k, 1])));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'فرمول نامعتبر است.';
  }
}

// Minimal 12dPL tokenizer. It only needs to be good enough to find statement
// boundaries, declarations and function bodies: comments, strings and
// preprocessor lines are recognised so their contents are never instrumented.

export type TokenKind = 'ident' | 'number' | 'string' | 'char' | 'punct' | 'preproc';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Offset of the first character in the source. */
  start: number;
  /** Offset one past the last character. */
  end: number;
  /** 1-based line of the first character. */
  line: number;
}

const PUNCT3 = ['<<=', '>>='];
const PUNCT2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '->'];

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  // True while only whitespace has been seen since the last newline; a '#'
  // there starts a preprocessor directive.
  let lineStart = true;
  const n = src.length;

  const isIdStart = (c: string) => /[A-Za-z_]/.test(c);
  const isId = (c: string) => /[A-Za-z0-9_]/.test(c);

  while (i < n) {
    const c = src[i];

    if (c === '\n') { line++; i++; lineStart = true; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v' || c === '﻿') { i++; continue; }

    // Line comment
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // Block comment
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') line++;
        i++;
      }
      i += 2;
      continue;
    }

    const start = i;
    const startLine = line;

    if (c === '#' && lineStart) {
      // Preprocessor directive, including backslash continuations. Comments
      // inside are kept as part of the directive text.
      while (i < n && src[i] !== '\n') {
        if (src[i] === '\\' && (src[i + 1] === '\n' || (src[i + 1] === '\r' && src[i + 2] === '\n'))) {
          i += src[i + 1] === '\r' ? 3 : 2;
          line++;
          continue;
        }
        if (src[i] === '/' && src[i + 1] === '*') {
          i += 2;
          while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
          i += 2;
          continue;
        }
        i++;
      }
      tokens.push({ kind: 'preproc', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }
    lineStart = false;

    if (c === '"' || c === "'") {
      i++;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      tokens.push({ kind: c === '"' ? 'string' : 'char', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }

    if (isIdStart(c)) {
      while (i < n && isId(src[i])) i++;
      tokens.push({ kind: 'ident', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }

    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      while (i < n && /[0-9A-Za-z_.]/.test(src[i])) {
        // exponent sign: 1e-5
        if ((src[i] === 'e' || src[i] === 'E') && (src[i + 1] === '-' || src[i + 1] === '+')) i++;
        i++;
      }
      tokens.push({ kind: 'number', text: src.slice(start, i), start, end: i, line: startLine });
      continue;
    }

    let p = PUNCT3.find((x) => src.startsWith(x, i)) ?? PUNCT2.find((x) => src.startsWith(x, i)) ?? c;
    i += p.length;
    tokens.push({ kind: 'punct', text: p, start, end: i, line: startLine });
  }
  return tokens;
}

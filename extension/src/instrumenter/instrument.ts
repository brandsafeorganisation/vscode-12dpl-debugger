// Rewrites a 12dPL macro so it reports to the debugger.
//
// Every injected piece of code is placed on the same line as the code it
// precedes, so line numbers in instrumented files match the originals. The
// only exception is the entry file, which gets one extra first line that
// includes the runtime.
//
// What gets injected (inside function bodies only):
//
//   at function entry   dbg12d_enter(<file>, <line>, "<name>");
//                       (main also gets dbg12d_init(); first)
//   before a statement  if (dbg12d_hit(<file>, <line>)) { <variable dumps> dbg12d_wait(); }
//   return ...;         dbg12d_leave(); return ...;
//                       ({ dbg12d_leave(); return ...; } as a brace-less if/else body)
//   function's final }  dbg12d_leave(); }
//                       (globals are dumped by one generated function,
//                       dbg12d_globals(), so a hit doesn't grow with them)
//   Wait_on_events(...) dbg12d_wait_on_events(...)   (and Wait_on_widgets):
//                       a panel macro spends most of its time in there, so
//                       the wrapper checks for stop/pause after every event
//                       (left out when the function ends with a return, which
//                       12d requires to be the last statement)
//
// A statement is only instrumented where a new statement can legally start:
// after ';', '{' or '}'. Bodies of brace-less if/else/for/while are left alone
// (no breakpoint on those lines), and so is the body of a switch itself, where
// 12d only allows case/default labels with braced blocks (the code inside
// those blocks is instrumented as usual).
//
// #define'd macros are read so a call like CHECK(x) whose expansion ends in
// ';' or '}' counts as a statement boundary, braces opened or closed by a
// macro (BEGIN_LOOP / END_LOOP) keep the block nesting right, and an
// object-like macro naming a type (#define Int Integer) declares variables.
//
// Quoted #includes are followed and rewritten to absolute paths of the
// instrumented copies, so the program compiles the same from inside 12d (where
// relative includes resolve against the project folder) and from outside.

import * as fs from 'fs';
import * as path from 'path';
import { Token, tokenize } from './tokenizer';
import { TYPE_NAMES } from './types';
import { InspectorTable, PRINTABLE, inspectFunction, resolveInspectors } from './inspectors';

export const RUNTIME_FILE_NAME = 'dbg12d_runtime.4dm';
export const INSPECTORS_FILE_NAME = 'dbg12d_inspectors.4dm';

export interface VarInfo {
  name: string;
  type: string;
  isArray: boolean;
}

export interface ScopedVar extends VarInfo {
  scope: 'L' | 'G';
}

export interface InstrumentedFile {
  /** 1-based id used in hit calls. */
  id: number;
  /** Absolute path of the original source. */
  source: string;
  /** Absolute path of the instrumented copy. */
  output: string;
  /** Lines (in the original file) that can hold a breakpoint. */
  breakpointLines: number[];
  /** Number of extra lines added at the top of the output (1 for the entry file; it also gets one at the end). */
  lineOffset: number;
  /**
   * Variables visible at each breakpoint line. Only some types have their
   * value sent by the macro; the rest are listed from here without a value.
   */
  variables: Record<number, ScopedVar[]>;
}

export interface InstrumentResult {
  entryOutput: string;
  /** Body of dbg12d_globals(): dump calls for every global the program declares. */
  globalsDump: string[];
  files: InstrumentedFile[];
  warnings: string[];
  /** Inspected types the program dumps directly (generate inspectors for these). */
  usedTypes: Set<string>;
}

interface SourceText {
  text: string;
  encoding: 'utf8' | 'utf8bom' | 'utf16le';
}

export function readSource(file: string): SourceText {
  const buf = fs.readFileSync(file);
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    return { text: buf.subarray(2).toString('utf16le'), encoding: 'utf16le' };
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: buf.subarray(3).toString('utf8'), encoding: 'utf8bom' };
  }
  return { text: buf.toString('utf8'), encoding: 'utf8' };
}

function writeSource(file: string, text: string, encoding: SourceText['encoding']) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (encoding === 'utf16le') {
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')]));
  } else if (encoding === 'utf8bom') {
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]));
  } else {
    fs.writeFileSync(file, text, 'utf8');
  }
}

/** Escape a value for use inside a 12dPL string literal. */
function lit(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/** How a variable of a given type is dumped, or undefined if it is shown without a value. */
function dumpCall(v: VarInfo, scope: 'L' | 'G', inspected: ReadonlySet<string>, used?: Set<string>): string | undefined {
  if (v.isArray) return undefined;
  const s = lit(scope);
  const nm = lit(v.name);
  if (PRINTABLE[v.type]) return `${PRINTABLE[v.type]}(${s}, ${nm}, ${v.name});`;
  if (inspected.has(v.type)) {
    used?.add(v.type);
    return `${inspectFunction(v.type)}(${s}, ${nm}, ${v.name}, 1);`;
  }
  return undefined;
}

interface Insertion {
  /** Source offset the text is inserted at. */
  at: number;
  text: string;
  /** Lower runs first among insertions at the same offset. */
  order: number;
}

/** What the instrumenter needs to know about a #define. */
export interface MacroInfo {
  params: boolean;
  /** First and last token of the expansion (after expanding nested macros). */
  first: string;
  last: string;
  /** '{' minus '}' in the expansion. */
  braceDelta: number;
  hasReturn: boolean;
  /** The type an object-like macro stands for, if its whole body is a type name. */
  typeAlias?: string;
}

/** Read "#define NAME[(params)] body" (backslash continuations allowed). */
function parseDefine(directive: string): { name: string; params: boolean; body: string } | undefined {
  const d = directive.replace(/\\\r?\n/g, ' ');
  const m = /^#\s*define\s+([A-Za-z_]\w*)(\([^)]*\))?(.*)$/s.exec(d);
  if (!m) return undefined;
  return { name: m[1], params: m[2] !== undefined, body: m[3] };
}

function analyseMacro(params: boolean, body: string, macros: ReadonlyMap<string, MacroInfo>): MacroInfo {
  const toks = tokenize(body).filter((t) => t.kind !== 'preproc');
  let braceDelta = 0;
  let hasReturn = false;
  for (const t of toks) {
    if (t.text === '{') braceDelta++;
    else if (t.text === '}') braceDelta--;
    else if (t.text === 'return') hasReturn = true;
    else if (t.kind === 'ident') {
      const inner = macros.get(t.text);
      if (inner) { braceDelta += inner.braceDelta; hasReturn ||= inner.hasReturn; }
    }
  }
  const edge = (t: Token | undefined, side: 'first' | 'last'): string => {
    if (!t) return '';
    const inner = t.kind === 'ident' ? macros.get(t.text) : undefined;
    return inner ? inner[side] : t.text;
  };
  let first = edge(toks[0], 'first');
  let last = toks[toks.length - 1]?.text ?? '';
  // NAME(args) at the end: what that call expands to ends the same way.
  const tail = toks[toks.length - 1];
  if (tail?.text === ')') {
    let depth = 0;
    for (let j = toks.length - 1; j >= 0; j--) {
      if (toks[j].text === ')') depth++;
      else if (toks[j].text === '(' && --depth === 0) {
        const callee = toks[j - 1] && macros.get(toks[j - 1].text);
        if (callee?.params) last = callee.last;
        break;
      }
    }
  } else {
    last = edge(tail, 'last');
  }
  const single = toks.length === 1 ? toks[0].text : undefined;
  const typeAlias = !params && single !== undefined
    ? (TYPE_NAMES.has(single) ? single : macros.get(single)?.typeAlias)
    : undefined;
  return { params, first, last, braceDelta, hasReturn, typeAlias };
}

interface FileContext {
  id: number;
  globals: VarInfo[];
  warnings: string[];
  sourcePath: string;
  /** Types that have inspectors (dumped through dbg12d_i_<Type>). */
  inspected?: ReadonlySet<string>;
  /** Filled with the inspected types this file dumps. */
  usedTypes?: Set<string>;
  /** #defines seen so far (shared by a program's files, in include order). */
  macros?: Map<string, MacroInfo>;
}

type BraceKind = 'function' | 'block' | 'init' | 'global' | 'do' | 'switch';

interface Brace {
  kind: BraceKind;
  /** Line of the '{'. */
  line: number;
  /** Variables declared directly in this block. */
  vars: VarInfo[];
}

/** What a preprocessor directive does to the code after it. */
type PpRole = 'if' | 'alt' | 'endif' | 'other';

/**
 * Work out which tokens the compiler actually sees. Code under "#if 0" (or
 * after the "#else" of an "#if 1") is dropped: it may not even be valid
 * 12dPL (the 12d library does this). Other conditions can't be evaluated
 * here, so every branch is kept; 'alt' marks the start of a second or later
 * kept branch, where the instrumenter rewinds to the state at the "#if".
 */
function preprocessorPass(toks: Token[]): { active: Token[]; roles: Map<Token, PpRole> } {
  type Frame = { parentActive: boolean; active: boolean; taken: boolean; anyKept: boolean };
  const stack: Frame[] = [];
  const roles = new Map<Token, PpRole>();
  const active: Token[] = [];
  const isActive = () => stack.length === 0 || stack[stack.length - 1].active;
  // 0 / 1 for a literal condition, undefined otherwise.
  const literal = (cond: string): 0 | 1 | undefined => {
    const c = cond.replace(/\r/g, '').replace(/\/\*.*?\*\//g, '').replace(/\/\/.*$/, '').trim().replace(/^\((.*)\)$/, '$1').trim();
    return c === '0' ? 0 : c === '1' ? 1 : undefined;
  };
  for (const t of toks) {
    if (t.kind !== 'preproc') {
      if (isActive()) active.push(t);
      continue;
    }
    const d = t.text.replace(/^#\s*/, '');
    const word = /^\w+/.exec(d)?.[0] ?? '';
    if (word === 'if' || word === 'ifdef' || word === 'ifndef') {
      const parentActive = isActive();
      const value = word === 'if' ? literal(d.slice(2)) : undefined;
      stack.push({ parentActive, active: parentActive && value !== 0, taken: value === 1, anyKept: parentActive && value !== 0 });
      if (parentActive) { roles.set(t, 'if'); active.push(t); }
    } else if ((word === 'else' || word === 'elif') && stack.length > 0) {
      const f = stack[stack.length - 1];
      const value = word === 'elif' ? literal(d.slice(4)) : 1;
      const keep = f.parentActive && !f.taken && value !== 0;
      if (keep) roles.set(t, f.anyKept ? 'alt' : 'other');
      if (f.parentActive) active.push(t);
      f.active = keep;
      f.anyKept ||= keep;
      if (word === 'else' || value === 1) f.taken ||= keep;
    } else if (word === 'endif' && stack.length > 0) {
      const f = stack.pop()!;
      if (f.parentActive) { roles.set(t, 'endif'); active.push(t); }
    } else if (isActive()) {
      roles.set(t, 'other');
      active.push(t);
    }
  }
  return { active, roles };
}

/**
 * Instrument one file's text. Includes are not followed here; the caller
 * rewrites include lines through `rewriteInclude`.
 */
export function instrumentText(
  src: string,
  ctx: FileContext,
  rewriteInclude: (directive: string) => string,
): { text: string; breakpointLines: number[]; variables: Record<number, ScopedVar[]> } {
  const { active: toks, roles: ppRoles } = preprocessorPass(tokenize(src));
  const ins: Insertion[] = [];
  const replacements: { start: number; end: number; text: string }[] = [];
  const bpLines = new Set<number>();
  const lineVars: Record<number, ScopedVar[]> = {};

  const braces: Brace[] = [];
  let parenDepth = 0;
  // Preprocessor #if nesting; used to avoid dumping variables declared in
  // conditionally compiled code (they may not exist).
  let ppDepth = 0;
  let functionPpDepth = 0;
  let globalPpDepth = 0;

  // Current function state
  let inFunction = false;
  let functionParams: VarInfo[] = [];
  let functionName = '';
  let lastHitLine = -1;
  // The return statement being read, if any, and whether it was wrapped in braces.
  let openReturn: { wrapped: boolean; functionLevel: boolean } | undefined;
  // The ';' ending a return that is a direct statement of the function body.
  let lastFunctionReturnEnd: Token | undefined;
  const inspected = ctx.inspected ?? new Set<string>();
  const macros = ctx.macros ?? new Map<string, MacroInfo>();
  /** The real type a type name stands for (following #define aliases), or undefined. */
  const typeOf = (name: string): string | undefined => (TYPE_NAMES.has(name) ? name : macros.get(name)?.typeAlias);
  // Last token of each macro call seen, with what the call expands to.
  const macroEnds = new Map<Token, { info: MacroInfo; start: Token }>();

  const sig = toks.filter((t) => t.kind !== 'preproc');
  // Map from token to index in sig for prev/next lookups
  const sigIndex = new Map<Token, number>();
  sig.forEach((t, k) => sigIndex.set(t, k));

  const prevSig = (t: Token): Token | undefined => {
    const k = sigIndex.get(t)!;
    return k > 0 ? sig[k - 1] : undefined;
  };

  const visibleVars = (): { locals: VarInfo[]; globals: VarInfo[] } => {
    const seen = new Set<string>();
    const locals: VarInfo[] = [];
    for (let b = braces.length - 1; b >= 0; b--) {
      const vs = braces[b].vars;
      for (let k = vs.length - 1; k >= 0; k--) {
        if (!seen.has(vs[k].name)) { seen.add(vs[k].name); locals.push(vs[k]); }
      }
      if (braces[b].kind === 'function') break;
    }
    for (let k = functionParams.length - 1; k >= 0; k--) {
      const p = functionParams[k];
      if (!seen.has(p.name)) { seen.add(p.name); locals.push(p); }
    }
    locals.reverse();
    const globals = ctx.globals.filter((g) => !seen.has(g.name));
    return { locals, globals };
  };

  const hitCode = (line: number): string => {
    const { locals, globals } = visibleVars();
    lineVars[line] = [
      ...locals.map((v) => ({ ...v, scope: 'L' as const })),
      ...globals.map((v) => ({ ...v, scope: 'G' as const })),
    ];
    const parts: string[] = [];
    for (const v of locals) {
      const call = dumpCall(v, 'L', inspected, ctx.usedTypes);
      if (call) parts.push(call);
    }
    parts.push('dbg12d_globals(); dbg12d_wait();');
    return `if (dbg12d_hit(${ctx.id}, ${line})) { ${parts.join(' ')} } `;
  };

  /** Parse a declaration starting at sig[k] (a type name) and return the declared variables. */
  const parseDeclaration = (k: number): VarInfo[] => {
    const type = typeOf(sig[k].text) ?? sig[k].text;
    const vars: VarInfo[] = [];
    let j = k + 1;
    let depth = 0;
    let expectName = true;
    while (j < sig.length) {
      const t = sig[j];
      if (depth === 0 && (t.text === ';' || t.text === ')')) break;
      if (t.text === '(' || t.text === '[' || t.text === '{') depth++;
      else if (t.text === ')' || t.text === ']' || t.text === '}') depth--;
      if (depth === 0 && t.text === ',') { expectName = true; j++; continue; }
      if (expectName && depth === 0 && t.kind === 'ident') {
        const isArray = sig[j + 1]?.text === '[';
        vars.push({ name: t.text, type, isArray });
        expectName = false;
      } else if (expectName && t.text !== '&') {
        expectName = false;
      }
      j++;
    }
    return vars;
  };

  /** Parse "(Type &name, Type name[])" parameter lists between sig[open] and sig[close]. */
  const parseParams = (open: number, close: number): VarInfo[] => {
    const out: VarInfo[] = [];
    let groupStart = open + 1;
    let depth = 0;
    for (let j = open + 1; j <= close; j++) {
      const t = sig[j];
      if (t.text === '(' || t.text === '[') depth++;
      if ((t.text === ')' || t.text === ']') && j !== close) depth--;
      if ((depth === 0 && t.text === ',') || j === close) {
        const group = sig.slice(groupStart, j);
        const idents = group.filter((g) => g.kind === 'ident');
        const type = idents.length >= 2 ? typeOf(idents[0].text) : undefined;
        if (type) {
          const name = idents[idents.length - 1].text;
          out.push({ name, type, isArray: group.some((g) => g.text === '[') });
        }
        groupStart = j + 1;
      }
    }
    return out;
  };

  /** Find index of the '(' matching the ')' at sig[k]. */
  const matchOpenParen = (k: number): number => {
    let depth = 0;
    for (let j = k; j >= 0; j--) {
      if (sig[j].text === ')') depth++;
      else if (sig[j].text === '(') { depth--; if (depth === 0) return j; }
    }
    return -1;
  };

  let lastClosedBraceKind: BraceKind | undefined;

  // State at each open "#if", so a second branch starts from where the first did.
  type State = {
    braces: Brace[]; parenDepth: number; inFunction: boolean; functionParams: VarInfo[]; functionName: string;
    functionPpDepth: number; openReturn: typeof openReturn; lastFunctionReturnEnd: Token | undefined;
  };
  const capture = (): State => ({
    braces: braces.map((b) => ({ ...b, vars: [...b.vars] })), parenDepth, inFunction, functionParams, functionName,
    functionPpDepth, openReturn, lastFunctionReturnEnd,
  });
  const restore = (st: State) => {
    braces.splice(0, braces.length, ...st.braces.map((b) => ({ ...b, vars: [...b.vars] })));
    ({ parenDepth, inFunction, functionParams, functionName, functionPpDepth, openReturn, lastFunctionReturnEnd } = st);
  };
  const ppStates: { atIf: State; firstEnd?: State }[] = [];

  for (const t of toks) {
    if (t.kind === 'preproc') {
      const role = ppRoles.get(t);
      if (role === 'if') {
        ppDepth++;
        ppStates.push({ atIf: capture() });
      } else if (role === 'endif') {
        ppDepth--;
        const st = ppStates.pop();
        if (st?.firstEnd) restore(st.firstEnd);
      } else if (role === 'alt') {
        const st = ppStates[ppStates.length - 1];
        if (st) {
          st.firstEnd ??= capture();
          restore(st.atIf);
        }
      }
      const d = t.text.replace(/^#\s*/, '');
      const def = parseDefine(t.text);
      if (def) macros.set(def.name, analyseMacro(def.params, def.body, macros));
      const undef = /^undef\s+(\w+)/.exec(d);
      if (undef) macros.delete(undef[1]);
      if (/^include\b/.test(d)) {
        const rewritten = rewriteInclude(t.text);
        if (rewritten !== t.text) replacements.push({ start: t.start, end: t.end, text: rewritten });
      }
      continue;
    }
    const k = sigIndex.get(t)!;
    const prev = prevSig(t);
    const top = braces[braces.length - 1];
    const inStatementContext = inFunction && top && top.kind !== 'init' && top.kind !== 'switch';

    // A macro call: note where it ends and what it expands to.
    const named = t.kind === 'ident' ? macros.get(t.text) : undefined;
    const macro = named && (!named.params || sig[k + 1]?.text === '(') ? named : undefined;
    if (macro) {
      let end = k;
      if (macro.params && sig[k + 1]?.text === '(') {
        let depth = 0;
        for (let j = k + 1; j < sig.length; j++) {
          if (sig[j].text === '(') depth++;
          else if (sig[j].text === ')' && --depth === 0) { end = j; break; }
        }
      }
      if (!macro.params || end !== k) macroEnds.set(sig[end], { info: macro, start: t });
    }

    // ---- statement start detection ----
    if (inStatementContext && parenDepth === 0) {
      const p = prev?.text;
      const prevMacro = prev && macroEnds.get(prev)?.info;
      const afterBoundary = p === ';' || p === '{' || p === '}' ||
        (prevMacro !== undefined && (prevMacro.last === ';' || prevMacro.last === '{' || prevMacro.last === '}'));
      const excluded =
        [t.text, macro?.first].some((x) => x === '}' || x === 'else' || x === 'case' || x === 'default') || t.text === ';' ||
        (t.text === 'while' && p === '}' && lastClosedBraceKind === 'do');
      if (afterBoundary && !excluded) {
        if (t.line !== lastHitLine) {
          ins.push({ at: t.start, text: hitCode(t.line), order: 10 });
          bpLines.add(t.line);
          lastHitLine = t.line;
        }
        // Declarations become visible to later statements.
        if (t.kind === 'ident' && typeOf(t.text) && sig[k + 1]?.kind === 'ident') {
          const vars = parseDeclaration(k);
          if (ppDepth === functionPpDepth) top.vars.push(...vars);
        }
      }
    }

    // ---- token handling ----
    switch (t.text) {
      case '(':
        parenDepth++;
        if (inFunction && prev?.text === 'for') {
          // for (Type name = ...; ...)
          const nxt = sig[k + 1];
          if (nxt && nxt.kind === 'ident' && typeOf(nxt.text) && sig[k + 2]?.kind === 'ident') {
            const vars = parseDeclaration(k + 1);
            // 12dPL: for-init variables stay in scope after the for statement.
            if (ppDepth === functionPpDepth && top) top.vars.push(...vars);
          }
        }
        break;
      case ')':
        parenDepth--;
        break;
      case '{': {
        let kind: BraceKind = 'block';
        if (!inFunction) {
          if (prev?.text === ')') {
            kind = 'function';
            const open = matchOpenParen(sigIndex.get(prev)!);
            const nameTok = open > 0 ? sig[open - 1] : undefined;
            functionName = nameTok?.kind === 'ident' ? nameTok.text : '?';
            functionParams = parseParams(open, sigIndex.get(prev)!);
            inFunction = true;
            functionPpDepth = ppDepth;
            lastHitLine = -1;
            const entry =
              (functionName === 'main' ? 'dbg12d_init(); ' : '') +
              `dbg12d_enter(${ctx.id}, ${nameTok?.line ?? t.line}, ${lit(functionName)}); `;
            ins.push({ at: t.end, text: ' ' + entry, order: 0 });
          } else {
            kind = 'global';
            globalPpDepth = ppDepth;
          }
        } else if (prev && (prev.text === '=' || prev.text === ',' || prev.text === '{') && (top?.kind === 'init' || prev.text === '=')) {
          kind = 'init';
        } else if (prev?.text === 'do') {
          kind = 'do';
        } else if (prev?.text === ')') {
          const open = matchOpenParen(sigIndex.get(prev)!);
          if (open > 0 && sig[open - 1].text === 'switch') kind = 'switch';
        }
        braces.push({ kind, line: t.line, vars: [] });
        break;
      }
      case '}': {
        if (braces.length === 0) ctx.warnings.push(`${ctx.sourcePath}:${t.line}: '}' has no matching '{'; instrumentation may be wrong.`);
        const b = braces.pop();
        lastClosedBraceKind = b?.kind;
        if (b?.kind === 'function') {
          // 12d insists a function's last statement is its return; nothing may follow it.
          if (!(lastFunctionReturnEnd && prev === lastFunctionReturnEnd)) {
            ins.push({ at: t.start, text: 'dbg12d_leave(); ', order: 20 });
          }
          inFunction = false;
          functionParams = [];
        }
        break;
      }
      case ';':
        if (parenDepth === 0 && openReturn) {
          if (openReturn.wrapped) ins.push({ at: t.end, text: ' }', order: 0 });
          else if (openReturn.functionLevel) lastFunctionReturnEnd = t;
          openReturn = undefined;
        }
        break;
      case 'Wait_on_events':
      case 'Wait_on_widgets':
        if (inFunction && sig[k + 1]?.text === '(') {
          replacements.push({ start: t.start, end: t.end, text: t.text === 'Wait_on_events' ? 'dbg12d_wait_on_events' : 'dbg12d_wait_on_widgets' });
        }
        break;
      case 'return':
        if (inFunction && parenDepth === 0) {
          // A return that is a statement of its own stays bare (so a function
          // still ends with 'return'); one that is the body of a brace-less
          // if/else/loop needs braces to hold two statements.
          const p = prev?.text;
          const wrapped = !(p === ';' || p === '{' || p === '}');
          replacements.push({ start: t.start, end: t.end, text: wrapped ? '{ dbg12d_leave(); return' : 'dbg12d_leave(); return' });
          openReturn = { wrapped, functionLevel: !wrapped && top?.kind === 'function' };
        }
        break;
    }

    // ---- braces opened or closed inside a macro's expansion ----
    const ended = macroEnds.get(t);
    if (ended) {
      const { info, start } = ended;
      for (let n = 0; n < info.braceDelta; n++) braces.push({ kind: inFunction ? 'block' : 'global', line: t.line, vars: [] });
      for (let n = 0; n > info.braceDelta; n--) {
        const b = braces.pop();
        if (!b) {
          ctx.warnings.push(`${ctx.sourcePath}:${t.line}: macro closes a '}' that has no matching '{'; instrumentation may be wrong.`);
        } else if (b.kind === 'function') {
          if (!info.hasReturn) ins.push({ at: start.start, text: 'dbg12d_leave(); ', order: 20 });
          inFunction = false;
          functionParams = [];
        }
      }
    }

    // ---- global variable declarations ----
    if (!inFunction && top?.kind === 'global' && braces.length === 1 && t.kind === 'ident' && typeOf(t.text) &&
        (prev?.text === '{' || prev?.text === ';') && sig[k + 1]?.kind === 'ident') {
      // Only track globals not hidden behind a conditional (apart from an include guard).
      if (ppDepth === globalPpDepth && globalPpDepth <= 1) ctx.globals.push(...parseDeclaration(k));
    }
  }

  for (const b of braces) ctx.warnings.push(`${ctx.sourcePath}:${b.line}: '{' is never closed; instrumentation may be wrong.`);

  // ---- apply edits ----
  type Edit = { start: number; end: number; text: string; order: number };
  const edits: Edit[] = [
    ...ins.map((x) => ({ start: x.at, end: x.at, text: x.text, order: x.order })),
    // Replacements sort after insertions at the same offset (hit code goes before 'return').
    ...replacements.map((r) => ({ ...r, order: 15 })),
  ];
  edits.sort((a, b) => a.start - b.start || a.order - b.order);
  let out = '';
  let pos = 0;
  for (const e of edits) {
    if (e.start < pos) continue; // overlapping (shouldn't happen)
    out += src.slice(pos, e.start) + e.text;
    pos = e.end;
  }
  out += src.slice(pos);
  return { text: out, breakpointLines: [...bpLines].sort((a, b) => a - b), variables: lineVars };
}

export interface ProgramOptions {
  /** Inspectors for non-text types (defaults to DEFAULT_INSPECTORS). */
  inspectors?: InspectorTable;
  /**
   * Extra folders to look for quoted #includes in, after the including file's
   * folder and the entry file's folder (e.g. the 12d project folder).
   */
  includePaths?: string[];
}

/** Forward-slash absolute path, as written into #include lines. */
export const includePath = (p: string) => path.resolve(p).split(path.sep).join('/');

/**
 * Instrument a macro and every local file it #includes (with quotes), writing
 * the result to outDir. Includes of instrumented files are rewritten to the
 * absolute paths of the instrumented copies. The entry file gets the runtime
 * included on a new first line and the inspectors on a new last line; the
 * caller writes those two files (generateRuntime / generateInspectors).
 */
export function instrumentProgram(entry: string, outDir: string, opts: ProgramOptions = {}): InstrumentResult {
  entry = path.resolve(entry);
  outDir = path.resolve(outDir);
  const root = path.dirname(entry);
  const files: InstrumentedFile[] = [];
  const byPath = new Map<string, InstrumentedFile>();
  const globals: VarInfo[] = [];
  const warnings: string[] = [];
  const inspected = new Set((opts.inspectors ?? resolveInspectors()).keys());
  const usedTypes = new Set<string>();
  const macros = new Map<string, MacroInfo>();
  const searchDirs = (opts.includePaths ?? []).map((d) => path.resolve(root, d));

  const key = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
  const isAbsolute = (p: string) => path.isAbsolute(p) || /^[A-Za-z]:[\\/]/.test(p);

  const outputFor = (src: string): string => {
    const rel = path.relative(root, src);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return path.join(outDir, rel);
    const flat = src.replace(/[:\\/]+/g, '_').replace(/^_+/, '');
    return path.join(outDir, '_external', flat);
  };

  const resolveInclude = (spec: string, fromFile: string): string | undefined => {
    const candidates = isAbsolute(spec)
      ? [spec]
      : [path.dirname(fromFile), root, ...searchDirs].map((d) => path.resolve(d, spec));
    return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
  };

  const visit = (src: string): InstrumentedFile => {
    const existing = byPath.get(key(src));
    if (existing) return existing;
    const isEntry = files.length === 0;
    const info: InstrumentedFile = {
      id: files.length + 1,
      source: src,
      output: outputFor(src),
      breakpointLines: [],
      lineOffset: isEntry ? 1 : 0,
      variables: {},
    };
    files.push(info);
    byPath.set(key(src), info);

    const { text, encoding } = readSource(src);
    const ctx: FileContext = { id: info.id, globals, warnings, sourcePath: src, inspected, usedTypes, macros };
    const rewriteInclude = (directive: string): string => {
      const m = /^(#\s*include\s*)"([^"]+)"(.*)$/s.exec(directive);
      if (!m) return directive;
      const target = resolveInclude(m[2], src);
      if (!target) {
        warnings.push(`${src}: could not find include "${m[2]}" (fine if it is in a branch that isn't compiled); left unchanged.`);
        return directive;
      }
      const child = visit(target);
      return `${m[1]}"${includePath(child.output)}"${m[3]}`;
    };
    const result = instrumentText(text, ctx, rewriteInclude);
    info.breakpointLines = result.breakpointLines;
    info.variables = result.variables;
    let out = result.text;
    if (isEntry) {
      const nl = out.includes('\r\n') ? '\r\n' : '\n';
      out = `#include "${includePath(path.join(outDir, RUNTIME_FILE_NAME))}"${nl}` + out;
      if (!/\n$/.test(out)) out += nl;
      out += `#include "${includePath(path.join(outDir, INSPECTORS_FILE_NAME))}"${nl}`;
    }
    writeSource(info.output, out, encoding);
    return info;
  };

  visit(entry);
  const seen = new Set<string>();
  const globalsDump: string[] = [];
  for (const g of globals) {
    if (seen.has(g.name)) continue;
    seen.add(g.name);
    const call = dumpCall(g, 'G', inspected, usedTypes);
    if (call) globalsDump.push(call);
  }
  return { entryOutput: files[0].output, globalsDump, files, warnings, usedTypes };
}

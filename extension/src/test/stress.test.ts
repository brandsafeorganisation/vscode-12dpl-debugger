// Larger and odder macros than the unit tests use: multi-line macros,
// unusual formatting, conditional compilation, and a generated program the
// size of a real one. Every test checks the same invariants:
//
//   - the instrumented file has the same lines as the original (the entry
//     file gets one runtime include before and one inspectors include after)
//   - removing the injected code gives back the original text exactly
//   - every dbg12d_hit(file, line) / dbg12d_enter(file, line, ...) sits on the
//     line it reports, so breakpoints and stack frames point at the right code
//   - the injected code has balanced braces
//   - breakpoint lines are exactly the lines marked with a trailing //>

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { instrumentProgram, instrumentText, InstrumentedFile, readSource } from '../instrumenter/instrument';
import { generateInspectors, resolveInspectors } from '../instrumenter/inspectors';
import { generateRuntime } from '../instrumenter/runtime';
import { tokenize } from '../instrumenter/tokenizer';
import { genProgram } from './bigProgram';

const FIXTURES = path.join(__dirname, '../../src/test/fixtures');

/** Remove everything the instrumenter injects. */
function strip(s: string) {
  return s
    .replace(/if \(dbg12d_hit\(\d+, \d+\)\) \{ [^\n]*?dbg12d_wait\(\); \} /g, '')
    .replace(/ (dbg12d_init\(\); )?dbg12d_enter\(\d+, \d+, "[^"]*"\); /g, '')
    .replace(/\{ dbg12d_leave\(\); return([^;]*;) \}/g, 'return$1')
    .replace(/dbg12d_leave\(\); /g, '')
    .replace(/dbg12d_wait_on_(events|widgets)\(/g, 'Wait_on_$1(');
}

const MARK = /\/\/>\s*$/;
const markedLines = (src: string) =>
  src.split(/\r?\n/).flatMap((l, i) => (MARK.test(l) ? [i + 1] : []));

const braceCount = (s: string) => {
  let n = 0;
  for (const t of tokenize(s)) {
    if (t.kind !== 'punct') continue;
    if (t.text === '{') n++;
    else if (t.text === '}') n--;
  }
  return n;
};

/** Check one instrumented file against its source. `offset` is the number of lines added on top. */
function checkFile(src: string, out: string, id: number, offset: number, bps: number[], label: string) {
  let lines = out.split('\n');
  if (offset) {
    assert.match(lines[0], /^#include ".*dbg12d_runtime\.4dm"\r?$/, `${label}: runtime include`);
    lines = lines.slice(1);
    // The inspectors include is added as a last line.
    const last = lines.length - 1 - (lines[lines.length - 1] === '' ? 1 : 0);
    assert.match(lines[last], /^#include ".*dbg12d_inspectors\.4dm"\r?$/, `${label}: inspectors include`);
    lines.splice(last, 1);
  }
  const body = lines.join('\n');
  const nl = src.includes('\r\n') ? '\r\n' : '\n';
  const srcBody = offset && !src.endsWith(nl) ? src + nl : src;
  assert.equal(lines.length, srcBody.split('\n').length, `${label}: line count changed`);
  // Quoted includes are rewritten to the instrumented copies' paths.
  const noIncludes = (x: string) => x.replace(/^(#\s*include\s*)"[^"]*"/gm, '$1""');
  assert.equal(noIncludes(strip(body)), noIncludes(srcBody), `${label}: stripping the injected code does not give the source back`);
  assert.equal(braceCount(body), braceCount(srcBody), `${label}: injected code has unbalanced braces`);

  const srcLines = srcBody.split('\n');
  lines.forEach((l, i) => {
    for (const m of l.matchAll(/dbg12d_hit\((\d+), (\d+)\)/g)) {
      assert.equal(+m[1], id, `${label}:${i + 1}: hit has file id ${m[1]}`);
      assert.equal(+m[2], i + 1, `${label}:${i + 1}: hit reports line ${m[2]}`);
    }
    for (const m of l.matchAll(/dbg12d_enter\((\d+), (\d+), "(\w+)"\)/g)) {
      assert.equal(+m[1], id, `${label}:${i + 1}: enter has file id ${m[1]}`);
      // The reported line is where the function name is written.
      assert.match(srcLines[+m[2] - 1], new RegExp(`\\b${m[3]}\\b`), `${label}:${i + 1}: enter reports line ${m[2]}`);
    }
  });
  const hitLines = [...body.matchAll(/dbg12d_hit\(\d+, (\d+)\)/g)].map((m) => +m[1]);
  assert.deepEqual([...new Set(hitLines)].sort((a, b) => a - b), bps, `${label}: hits and breakpoint lines differ`);
  assert.deepEqual(bps, markedLines(src), `${label}: breakpoint lines differ from the //> marks`);
}

function instrumentFixture(src: string) {
  const warnings: string[] = [];
  const r = instrumentText(src, { id: 1, globals: [], warnings, sourcePath: 'fixture.4dm', inspected: new Set() }, (d) => d);
  return { ...r, warnings };
}

for (const name of ['macros', 'formatting', 'preprocessor']) {
  for (const crlf of [false, true]) {
    test(`${name}.4dm${crlf ? ' (CRLF)' : ''}: lines, breakpoints and reversibility`, () => {
      let src = fs.readFileSync(path.join(FIXTURES, `${name}.4dm`), 'utf8').replace(/\r\n/g, '\n');
      if (crlf) src = src.replace(/\n/g, '\r\n');
      const r = instrumentFixture(src);
      assert.deepEqual(r.warnings, []);
      checkFile(src, r.text, 1, 0, r.breakpointLines, `${name}.4dm`);
    });
  }
}

test('macros: braces from BEGIN/END macros keep scopes right, type aliases declare variables', () => {
  const src = fs.readFileSync(path.join(FIXTURES, 'macros.4dm'), 'utf8').replace(/\r\n/g, '\n');
  const { variables, text } = instrumentFixture(src);
  const lineOf = (s: string) => src.split('\n').findIndex((l) => l.includes(s)) + 1;
  const names = (s: string) => variables[lineOf(s)].filter((v) => v.scope === 'L').map((v) => `${v.type} ${v.name}`);
  assert.deepEqual(names('Name l_after_check'), ['Integer p_n', 'Text p_label', 'Integer l_total']);
  assert.deepEqual(names('l_total += l_inner'), ['Integer p_n', 'Text p_label', 'Integer l_total', 'Text l_after_check', 'Integer l_inner']);
  // l_inner went out of scope with END_BLOCK.
  assert.deepEqual(names('Int l_last'), ['Integer p_n', 'Text p_label', 'Integer l_total', 'Text l_after_check']);
  // Globals declared through an alias are known too, and a hit line doesn't list them as dumps.
  const g = variables[lineOf('Int l_last')].filter((v) => v.scope === 'G').map((v) => `${v.type} ${v.name}`);
  assert.deepEqual(g, ['Integer g_count', 'Text g_title']);
  assert.doesNotMatch(text, /"G"/);
  // main is still recognised as a function after all of that.
  assert.match(text, /dbg12d_init\(\); dbg12d_enter\(1, \d+, "main"\)/);
});

test('a macro that closes a function still leaves it', () => {
  const src = [
    '#define END_FUNCTION }',
    'void f()',
    '{',
    '  Print("x");',
    'END_FUNCTION',
    'void main()',
    '{',
    '  f();',
    '}',
  ].join('\n');
  const { text, warnings } = instrumentFixture(src);
  assert.deepEqual(warnings, []);
  assert.equal(text.split('\n')[4], 'dbg12d_leave(); END_FUNCTION');
  assert.match(text.split('\n')[6], /dbg12d_enter\(1, 6, "main"\)/);
});

// ---------------------------------------------------------------- big program

test('a large program: nested includes, a CPATH include, 250 globals, 120 functions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-big-'));
  try {
    const entry = genProgram(path.join(tmp, 'src'), path.join(tmp, 'cpath'));
    const outDir = path.join(tmp, 'out');
    const started = Date.now();
    const inspectors = resolveInspectors();
    const r = instrumentProgram(entry, outDir, { inspectors, includePaths: [path.join(tmp, 'cpath')] });
    const elapsed = Date.now() - started;

    assert.deepEqual(r.warnings, []);
    assert.deepEqual(r.files.map((f) => path.relative(tmp, f.source).split(path.sep).join('/')), [
      'src/big_main.4dm', 'src/lib/util.4dm', 'src/lib/deep/inner.4dm', 'src/lib/macros.h', 'cpath/shared_from_cpath.4dm',
    ]);
    assert.ok(elapsed < 10000, `instrumenting took ${elapsed} ms`);

    let maxLine = 0;
    let totalOut = 0;
    for (const f of r.files) {
      const src = readSource(f.source).text;
      const out = readSource(f.output).text;
      totalOut += out.length;
      checkFile(src, out, f.id, f.lineOffset, f.breakpointLines, path.basename(f.source));
      for (const l of out.split('\n')) maxLine = Math.max(maxLine, l.length);
      // Includes point at the instrumented copies.
      for (const m of out.matchAll(/#include "([^"]+)"/g)) {
        if (!/dbg12d_(runtime|inspectors)/.test(m[1])) assert.ok(r.files.some((x) => x.output === path.resolve(m[1])), m[1]);
      }
    }
    // Globals are dumped once, in dbg12d_globals(), not on every hit.
    assert.ok(maxLine < 2000, `longest instrumented line is ${maxLine} characters`);
    assert.ok(totalOut < 3_000_000, `instrumented program is ${totalOut} characters`);
    assert.equal(r.globalsDump.length, 250); // every global type here has a dump
    const insp = generateInspectors(inspectors, r.globalsDump);
    assert.match(insp, /void dbg12d_globals\(\)\n\{\n  dbg12d_v_int\("G", "g_0", g_0\);/);
    assert.match(generateRuntime({ sessionDir: 'x' }), /^void dbg12d_globals\(\);$/m);
    assert.match(insp, /dbg12d_i_Element\("G", "g_4", g_4, 1\);/);

    // Every line where a global is in scope lists it, so the adapter shows it.
    const entryInfo = r.files[0] as InstrumentedFile;
    const someLine = entryInfo.breakpointLines[entryInfo.breakpointLines.length - 1];
    assert.equal(entryInfo.variables[someLine].filter((v) => v.scope === 'G').length, 250);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

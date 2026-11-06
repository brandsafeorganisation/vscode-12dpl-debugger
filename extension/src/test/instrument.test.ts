import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { instrumentProgram, instrumentText, VarInfo } from '../instrumenter/instrument';
import { generateRuntime } from '../instrumenter/runtime';

function run(src: string, globals: VarInfo[] = []) {
  const warnings: string[] = [];
  const r = instrumentText(src, { id: 1, globals, warnings, sourcePath: 'test.4dm' }, (d) => d);
  return { ...r, warnings };
}

/** Strip injected code so the result can be compared to the original. */
function strip(s: string) {
  return s
    .replace(/if \(dbg12d_hit\(\d+, \d+\)\) \{ [^\n]*?dbg12d_wait\(\); \} /g, '')
    .replace(/ dbg12d_init\(\); /g, '')
    .replace(/ dbg12d_enter\(\d+, \d+, "[^"]*"\); /g, '')
    .replace(/\{ dbg12d_leave\(\); return([^;]*;) \}/g, 'return$1')
    .replace(/dbg12d_leave\(\); /g, '');
}

test('keeps line numbers and is reversible', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../resources/macros/offsetter.4dm'), 'utf8');
  const { text } = run(src);
  assert.equal(text.split('\n').length, src.split('\n').length);
  assert.equal(strip(text), src);
});

test('instruments statements, function entry and returns', () => {
  const src = [
    'Integer f(Integer p_a, Text &p_t)', // 1
    '{',                                 // 2
    '  Integer l_x = p_a;',              // 3
    '  if (l_x > 1) return 1;',          // 4
    '  return 0;',                       // 5
    '}',                                 // 6
  ].join('\n');
  const { text, breakpointLines, variables } = run(src);
  assert.deepEqual(breakpointLines, [3, 4, 5]);
  const lines = text.split('\n');
  assert.match(lines[1], /^\{ dbg12d_enter\(1, 1, "f"\); $/);
  assert.match(lines[3], /^  if \(dbg12d_hit\(1, 4\)\) \{ .*dbg12d_v_int\("L", "l_x", l_x\);.* \} if \(l_x > 1\) \{ dbg12d_leave\(\); return 1; \}$/);
  assert.match(lines[4], /\{ dbg12d_leave\(\); return 0; \}$/);
  assert.equal(lines[5], 'dbg12d_leave(); }');
  // Parameters are visible from the first line; l_x only after its declaration.
  assert.deepEqual(variables[3].map((v) => v.name), ['p_a', 'p_t']);
  assert.deepEqual(variables[4].map((v) => v.name), ['p_a', 'p_t', 'l_x']);
});

test('main gets dbg12d_init', () => {
  const { text } = run('void main()\n{\n  Print("hi");\n}\n');
  assert.match(text, /\{ dbg12d_init\(\); dbg12d_enter\(1, 1, "main"\); /);
});

test('does not instrument brace-less bodies, else, case labels or do-while tails', () => {
  const src = [
    'void f()',                          // 1
    '{',                                 // 2
    '  Integer i = 0;',                  // 3
    '  if (i == 0)',                     // 4
    '    i = 1;',                        // 5  brace-less body: no hit
    '  else',                            // 6
    '    i = 2;',                        // 7
    '  switch (i) {',                    // 8
    '    case 1 : {',                    // 9
    '      i = 3;',                      // 10
    '      break;',                      // 11
    '    }',                             // 12
    '    default : i = 4;',              // 13 statement after a case label: hit
    '  }',                               // 14
    '  do {',                            // 15
    '    i++;',                          // 16
    '  } while (i < 10);',               // 17 do-while tail: no hit
    '  for (Integer k = 0; k < 2; k++) i++;', // 18
    '  Print(k);',                       // 19 k still visible (12dPL for-init scope)
    '}',
  ].join('\n');
  const { text, breakpointLines, variables } = run(src);
  assert.deepEqual(breakpointLines, [3, 4, 8, 9, 10, 11, 13, 15, 16, 18, 19]);
  const lines = text.split('\n');
  assert.equal(lines[4], '    i = 1;');
  assert.equal(lines[5], '  else');
  assert.equal(lines[16], '  } while (i < 10);');
  assert.match(lines[12], /^    default : if \(dbg12d_hit\(1, 13\)\)/);
  assert.deepEqual(variables[19].map((v) => v.name), ['i', 'k']);
  assert.equal(strip(text), src);
});

test('ignores braces in strings, comments, preprocessor lines and initialisers', () => {
  const src = [
    '#define OPEN {',                    // 1
    'void f()',                          // 2
    '{',                                 // 3
    '  Text t = "a { b ; c }";',         // 4
    '  // { not a block',                // 5
    '  /* ; } */ Integer a[3] = {1, 2, 3};', // 6
    '  Print(t);',                       // 7
    '}',
  ].join('\n');
  const { text, breakpointLines, variables, warnings } = run(src);
  assert.deepEqual(warnings, []);
  assert.deepEqual(breakpointLines, [4, 6, 7]);
  assert.equal(strip(text), src);
  assert.deepEqual(variables[7], [
    { name: 't', type: 'Text', isArray: false, scope: 'L' },
    { name: 'a', type: 'Integer', isArray: true, scope: 'L' },
  ]);
  // Arrays are listed but not dumped.
  assert.doesNotMatch(text.split('\n')[6], /"a", a\)/);
});

test('block scoping and global variables', () => {
  const globals: VarInfo[] = [];
  const src = [
    '{',                                 // 1
    '  Integer g_n;',                    // 2
    '  Text    g_name;',                 // 3
    '}',                                 // 4
    'void f()',                          // 5
    '{',                                 // 6
    '  {',                               // 7
    '    Real l_inner = 1.0;',           // 8
    '    Print(l_inner);',               // 9
    '  }',                               // 10
    '  Integer g_n = 2;',                // 11 shadows the global
    '  Print(g_n);',                     // 12
    '}',
  ].join('\n');
  const { variables } = run(src, globals);
  assert.deepEqual(globals.map((g) => g.name), ['g_n', 'g_name']);
  assert.deepEqual(variables[9].map((v) => v.scope + v.name), ['Ll_inner', 'Gg_n', 'Gg_name']);
  assert.deepEqual(variables[12].map((v) => v.scope + v.name), ['Lg_n', 'Gg_name']);
});

test('variables declared under a preprocessor conditional are not dumped', () => {
  const src = 'void f()\n{\n#ifdef DEBUG\n  Integer l_dbg = 1;\n#endif\n  Print(1);\n}\n';
  const { variables } = run(src);
  assert.deepEqual(variables[6], []);
});

test('instrumentProgram follows includes, keeps encodings, rewrites paths', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-'));
  const out = path.join(dir, 'out');
  fs.mkdirSync(path.join(dir, 'src'));
  // Entry file in UTF-16 LE like files saved by 12d.
  const entry = '#include <set_ups.h>\n#include "src/lib.4dm"\nvoid main()\n{\n  helper();\n}\n';
  fs.writeFileSync(path.join(dir, 'main.4dm'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(entry, 'utf16le')]));
  fs.writeFileSync(path.join(dir, 'src', 'lib.4dm'), '#include "other.4dm"\nvoid helper()\n{\n  other();\n}\n');
  fs.writeFileSync(path.join(dir, 'src', 'other.4dm'), 'void other()\n{\n  Print(1);\n}\n');

  const r = instrumentProgram(path.join(dir, 'main.4dm'), out);
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.files.map((f) => path.relative(out, f.output)), ['main.4dm', path.join('src', 'lib.4dm'), path.join('src', 'other.4dm')]);

  const mainBuf = fs.readFileSync(path.join(out, 'main.4dm'));
  assert.deepEqual([...mainBuf.subarray(0, 2)], [0xff, 0xfe]);
  const mainOut = mainBuf.subarray(2).toString('utf16le').split('\n');
  assert.equal(mainOut[0], '#include "dbg12d_runtime.4dm"');
  assert.equal(mainOut[1], '#include <set_ups.h>');
  assert.equal(mainOut[2], '#include "src/lib.4dm"');
  assert.match(fs.readFileSync(path.join(out, 'src', 'lib.4dm'), 'utf8'), /^#include "other.4dm"\n/);
  assert.match(fs.readFileSync(path.join(out, 'src', 'other.4dm'), 'utf8'), /dbg12d_hit\(3, 3\)/);
});

test('runtime has balanced braces and the session directory', () => {
  const rt = generateRuntime({ sessionDir: 'C:\\temp\\dbg session' });
  assert.match(rt, /#define DBG12D_DIR\s+"C:\/temp\/dbg session\/"/);
  const { warnings } = run(rt);
  assert.deepEqual(warnings, []);
});

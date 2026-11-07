import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { instrumentProgram, instrumentText, VarInfo } from '../instrumenter/instrument';
import { generateRuntime } from '../instrumenter/runtime';
import { generateInspectors, parseInspector, resolveInspectors, restrictInspectors } from '../instrumenter/inspectors';

function run(src: string, globals: VarInfo[] = [], inspected: string[] = []) {
  const warnings: string[] = [];
  const r = instrumentText(src, { id: 1, globals, warnings, sourcePath: 'test.4dm', inspected: new Set(inspected) }, (d) => d);
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
  // The final return stays the last statement: not wrapped, nothing after it.
  assert.match(lines[4], /\} dbg12d_leave\(\); return 0;$/);
  assert.equal(lines[5], '}');
  // Parameters are visible from the first line; l_x only after its declaration.
  assert.deepEqual(variables[3].map((v) => v.name), ['p_a', 'p_t']);
  assert.deepEqual(variables[4].map((v) => v.name), ['p_a', 'p_t', 'l_x']);
});

test('main gets dbg12d_init', () => {
  const { text } = run('void main()\n{\n  Print("hi");\n}\n');
  assert.match(text, /\{ dbg12d_init\(\); dbg12d_enter\(1, 1, "main"\); /);
});

test('void functions without a final return still leave', () => {
  const { text } = run('void f(Integer p_a)\n{\n  if (p_a) {\n    return;\n  }\n  Print(p_a);\n}\n');
  const lines = text.split('\n');
  assert.match(lines[3], /dbg12d_leave\(\); return;$/);
  assert.equal(lines[6], 'dbg12d_leave(); }');
});

test('does not instrument brace-less bodies, else, switch bodies or do-while tails', () => {
  const src = [
    'void f()',                          // 1
    '{',                                 // 2
    '  Integer i = 0;',                  // 3
    '  if (i == 0)',                     // 4
    '    i = 1;',                        // 5  brace-less body: no hit
    '  else',                            // 6
    '    i = 2;',                        // 7
    '  switch (i) {',                    // 8
    '    case 1 : {',                    // 9  label: no hit (12d allows no code outside the braces)
    '      i = 3;',                      // 10
    '    } break;',                      // 11 break after the block: no hit
    '    default : {',                   // 12
    '      i = 4;',                      // 13
    '    }',                             // 14
    '  }',                               // 15
    '  do {',                            // 16
    '    i++;',                          // 17
    '  } while (i < 10);',               // 18 do-while tail: no hit
    '  for (Integer k = 0; k < 2; k++) i++;', // 19
    '  Print(k);',                       // 20 k still visible (12dPL for-init scope)
    '}',
  ].join('\n');
  const { text, breakpointLines, variables } = run(src);
  assert.deepEqual(breakpointLines, [3, 4, 8, 10, 13, 16, 17, 19, 20]);
  const lines = text.split('\n');
  assert.equal(lines[4], '    i = 1;');
  assert.equal(lines[5], '  else');
  assert.equal(lines[8], '    case 1 : {');
  assert.equal(lines[10], '    } break;');
  assert.equal(lines[11], '    default : {');
  assert.match(lines[12], /^      if \(dbg12d_hit\(1, 13\)\)/);
  assert.equal(lines[17], '  } while (i < 10);');
  assert.deepEqual(variables[20].map((v) => v.name), ['i', 'k']);
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
  const abs = (...p: string[]) => path.join(out, ...p).split(path.sep).join('/');
  // Includes become absolute, so compiling from inside 12d finds the instrumented copies.
  assert.equal(mainOut[0], `#include "${abs('dbg12d_runtime.4dm')}"`);
  assert.equal(mainOut[1], '#include <set_ups.h>');
  assert.equal(mainOut[2], `#include "${abs('src', 'lib.4dm')}"`);
  assert.equal(mainOut[mainOut.length - 2], `#include "${abs('dbg12d_inspectors.4dm')}"`);
  assert.equal(mainOut.length, entry.split('\n').length + 2);
  assert.match(fs.readFileSync(path.join(out, 'src', 'lib.4dm'), 'utf8'), new RegExp(`^#include "${abs('src', 'other.4dm')}"\n`));
  assert.match(fs.readFileSync(path.join(out, 'src', 'other.4dm'), 'utf8'), /dbg12d_hit\(3, 3\)/);
});

test('runtime has balanced braces and the session directory', () => {
  const rt = generateRuntime({ sessionDir: 'C:\\temp\\dbg session' });
  assert.match(rt, /#define DBG12D_DIR\s+"C:\/temp\/dbg session\/"/);
  const { warnings } = run(rt);
  assert.deepEqual(warnings, []);
});

test('conditional includes: both branches resolve, missing ones are left alone', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-'));
  const out = path.join(dir, 'out');
  const proj = path.join(dir, 'project');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.mkdirSync(proj);
  const absLib = path.join(dir, 'src', 'build.4dm').split(path.sep).join('/');
  fs.writeFileSync(path.join(dir, 'main.4dm'), [
    '#ifdef __COMPILING_OUTSIDE_12D',
    `#include "${absLib}"`,
    '#else',
    '#include "src/build.4dm"',
    '#endif',
    '#include "only_in_project.h"',
    '#include "nowhere.h"',
    'void main()', '{', '  build();', '}', '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'src', 'build.4dm'), 'void build()\n{\n  Print(1);\n}\n');
  fs.writeFileSync(path.join(proj, 'only_in_project.h'), '#define X 1\n');

  const r = instrumentProgram(path.join(dir, 'main.4dm'), out, { includePaths: [proj] });
  assert.equal(r.files.length, 3);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /nowhere\.h/);
  const lines = fs.readFileSync(path.join(out, 'main.4dm'), 'utf8').split('\n');
  const built = path.join(out, 'src', 'build.4dm').split(path.sep).join('/');
  assert.equal(lines[2], `#include "${built}"`);
  assert.equal(lines[4], `#include "${built}"`);
  assert.equal(lines[6], `#include "${path.join(out, 'project', 'only_in_project.h').split(path.sep).join('/')}"`);
  assert.equal(lines[7], '#include "nowhere.h"');
});

test('inspector signatures', () => {
  assert.deepEqual(parseInspector('Integer Get_name(Element elt, Text &name)'), {
    signature: 'Integer Get_name(Element elt, Text &name)', returnType: 'Integer', func: 'Get_name', target: 'Element',
    args: [{ kind: 'target' }, { kind: 'member', type: 'Text', name: 'name' }],
  });
  const lits = parseInspector('Integer Get_attribute(Attributes & att, "a, b", Real& width)');
  assert.deepEqual(lits.args, [{ kind: 'target' }, { kind: 'literal', text: '"a, b"' }, { kind: 'member', type: 'Real', name: 'width' }]);
  assert.equal(parseInspector('Integer Get_number_of_items(Dynamic_Integer list)').args.length, 1);
  assert.throws(() => parseInspector('Integer Get_x(Element elt, Text name)'), /not a reference/);
  assert.throws(() => parseInspector('Integer Get_x(Nonsense n, Text &t)'), /first parameter/);
  assert.throws(() => parseInspector('Get_x(Element e)'), /expected/);

  // User inspectors replace the defaults for their type only.
  const table = resolveInspectors(['Integer Get_colour(Element elt, Integer &colour)']);
  assert.deepEqual(table.get('Element')!.map((i) => i.func), ['Get_colour']);
  assert.deepEqual(table.get('Model')!.map((i) => i.func), ['Get_name', 'Get_number_of_items']);
});

test('inspected variables are dumped through generated functions', () => {
  const src = 'void f(Element p_elt)\n{\n  Dynamic_Integer l_list;\n  Print(1);\n}\n';
  const { text } = run(src, [], ['Element']);
  const line = text.split('\n')[3];
  assert.match(line, /dbg12d_i_Element\("L", "p_elt", p_elt, 1\);/);
  assert.doesNotMatch(line, /l_list/);

  const table = resolveInspectors(['Integer Get_number_of_items(Dynamic_Integer list)']);
  const gen = generateInspectors(table);
  assert.deepEqual(run(gen).warnings, []);
  assert.match(gen, /void dbg12d_i_Element\(Text p_scope, Text p_name, Element &p_value, Integer p_depth\)/);
  assert.match(gen, /l_rc = Get_name\(p_value, l_1_1\);\n  if \(l_rc == 0\) \{\n    dbg12d_v_text\(p_scope, p_name \+ "\.name", l_1_1\);/);
  // Element.model is itself inspected, one level deeper.
  assert.match(gen, /dbg12d_i_Model\(p_scope, p_name \+ "\.model", l_4_1, p_depth \+ 1\)/);
  assert.match(gen, /Integer l_1_r = Get_number_of_items\(p_value\);\n  dbg12d_v_int\(p_scope, p_name \+ "\.Get_number_of_items", l_1_r\);/);
  // Every non-void generated function ends with its return; the runtime declares them all.
  const rt = generateRuntime({ sessionDir: '/tmp/x', inspectors: table });
  for (const t of ['Element', 'Model', 'Dynamic_Integer']) {
    assert.match(rt, new RegExp(`void dbg12d_i_${t}\\(Text p_scope, Text p_name, ${t} &p_value, Integer p_depth\\);`));
  }
});

test('every non-void runtime function ends with return', () => {
  const rt = generateRuntime({ sessionDir: '/tmp/x' });
  const fns = rt.matchAll(/^(\w+) (dbg12d_\w+)\([^)]*\)\n(?:\/\/[^\n]*\n)*\{\n([\s\S]*?)\n\}$/gm);
  let n = 0;
  for (const [, ret, name, body] of fns) {
    n++;
    if (ret !== 'void') assert.match(body, /\n?  return [^;]*;$/, name);
  }
  assert.ok(n > 10);
});

test('only the inspected types a program uses get inspector code', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-'));
  fs.writeFileSync(path.join(dir, 'main.4dm'), 'void main()\n{\n  Element l_elt;\n  Real_Box l_box;\n  Print(1);\n}\n');
  const all = resolveInspectors();
  const r = instrumentProgram(path.join(dir, 'main.4dm'), path.join(dir, 'out'), { inspectors: all });
  assert.deepEqual([...r.usedTypes].sort(), ['Element', 'Real_Box']);
  // Element's model member pulls in Model.
  assert.deepEqual([...restrictInspectors(all, r.usedTypes).keys()].sort(), ['Element', 'Model', 'Real_Box']);
});

test('runtime refuses a second running copy and unlocks on every way out', () => {
  const rt = generateRuntime({ sessionDir: '/tmp/x' });
  assert.match(rt, /if \(File_exists\(DBG12D_DIR \+ "macro.lock"\) != 0\) \{[\s\S]*?Exit\(/);
  // exited, terminate, and attach timeout all remove the lock.
  assert.equal(rt.match(/dbg12d_unlock\(\);/g)!.length, 3);
});

// Generates a large 12dPL program for the stress tests: nested includes, a
// CPATH include, 250 globals, 120 functions in several layouts, multi-line
// macros and conditional code. Lines meant to stop end with //>.

import * as fs from 'fs';
import * as path from 'path';

const TYPES = ['Integer', 'Real', 'Text', 'Integer64', 'Element', 'Uid'];

/** One function in one of several styles. Lines meant to stop end with //>. */
function genFunction(name: string, n: number, out: string[]) {
  const style = n % 4;
  const stop = (s: string) => out.push(s.padEnd(60) + '//>');
  if (style === 0) {
    out.push(`Integer ${name}(Integer p_a, Text &p_t, Real p_r)`, '{');
  } else if (style === 1) {
    out.push(`Integer ${name} (`, '  Integer p_a,', '  Text   &p_t,', '  Real    p_r', ') {');
  } else {
    out.push(`Integer`, `${name}(Integer p_a,Text &p_t,Real p_r)`, '{');
  }
  for (let v = 0; v < 12; v++) stop(`  ${TYPES[v % TYPES.length]} l_${v}${['', ' = 0', ' = 0.5', ' = ""', ' = 0', ''][v % 6]};`);
  // Nested blocks, alternating brace styles.
  let indent = '  ';
  for (let d = 0; d < 6; d++) {
    if (d % 2) {
      stop(`${indent}if (p_a > ${d}) {`);
    } else {
      stop(`${indent}if (p_a > ${d})`);
      out.push(`${indent}{`);
    }
    indent += '  ';
    stop(`${indent}l_0 += ${d};`);
  }
  for (let d = 5; d >= 0; d--) {
    indent = indent.slice(2);
    out.push(`${indent}}`);
  }
  stop('  for (Integer i = 1; i <= 3; i++) l_0++;');
  stop('  CHECKED(l_0)');
  stop('  TWO_LINES("a",');
  out.push('            "b");');
  out.push('#ifdef __COMPILING_OUTSIDE_12D');
  stop('  l_0 = 1;');
  out.push('#else');
  stop('  l_0 = 2;');
  out.push('#endif');
  out.push('#if 0');
  out.push('  this is } not { code');
  out.push('#endif');
  stop('  switch (l_0) {');
  out.push('    case 1 : {');
  stop('      l_0 = 2;');
  out.push('    } break;');
  out.push('    default : {');
  stop('      l_0 = 3;');
  out.push('    }');
  out.push('  }');
  stop('  p_t = "done; {";  l_0++;');
  stop(`  if (p_a == ${n}) return l_0;`);
  stop('  return 0;');
  out.push('}', '');
}

export function genProgram(dir: string, cpathDir: string) {
  fs.mkdirSync(path.join(dir, 'lib', 'deep'), { recursive: true });
  fs.mkdirSync(cpathDir, { recursive: true });
  const files: Record<string, string[]> = {};

  const macros = [
    '#ifndef BIG_MACROS',
    '#define BIG_MACROS',
    '#define CHECKED(x) if ((x) < 0) { \\',
    '    Print("bad\\n");               \\',
    '  }',
    '#define TWO_LINES(a, b) \\',
    '  Print(a);         \\',
    '  Print(b);',
    '#endif',
  ];
  files['lib/macros.h'] = macros;

  const inner: string[] = ['#include "../macros.h"', ''];
  for (let f = 0; f < 20; f++) genFunction(`inner_${f}`, f, inner);
  files['lib/deep/inner.4dm'] = inner;

  const util: string[] = ['#include "deep/inner.4dm"', ''];
  for (let f = 0; f < 40; f++) genFunction(`util_${f}`, f, util);
  files['lib/util.4dm'] = util;

  const shared: string[] = ['#include "lib/macros.h"', ''];
  for (let f = 0; f < 20; f++) genFunction(`shared_${f}`, f, shared);

  const main: string[] = ['#include "lib/util.4dm"', '#include "shared_from_cpath.4dm"', '', '{'];
  for (let g = 0; g < 250; g++) main.push(`  ${TYPES[g % TYPES.length]} g_${g};`);
  main.push('}', '');
  for (let f = 0; f < 40; f++) genFunction(`main_fn_${f}`, f, main);
  main.push('void main()', '{');
  const stop = (s: string) => main.push(s.padEnd(60) + '//>');
  stop('  Panel panel = Create_panel("big", 1);');
  stop('  Integer doit = 1;');
  stop('  while (doit) {');
  stop('    Integer id; Text cmd, msg;');
  stop('    Integer ret = Wait_on_widgets(id, cmd, msg);');
  stop('    if (cmd == "Panel Quit") doit = 0;');
  main.push('  }');
  for (let f = 0; f < 40; f++) stop(`  main_fn_${f}(${f}, g_2, 1.0);`);
  main.push('}');

  for (const [rel, lines] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(cpathDir, 'shared_from_cpath.4dm'), shared.join('\r\n') + '\r\n');
  fs.writeFileSync(path.join(dir, 'big_main.4dm'), main.join('\n') + '\n');
  return path.join(dir, 'big_main.4dm');
}

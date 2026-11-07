// Custom displays for types that have no text form (Element, Model, ...).
//
// An inspector is a 12dPL function signature, written the way it appears in
// the 12d documentation, that reads one piece of information out of a value:
//
//   Integer Get_name(Element elt, Text &name)
//
// The first parameter is the value being inspected, so its type (Element) is
// the type this inspector applies to. Every reference (&) parameter becomes a
// member named after the parameter ("name"). Other parameters can be given as
// literals, which are passed as-is:
//
//   Integer Get_attribute(Attributes att, "width", Real &width)
//
// With no reference parameters, the return value is the member, named after
// the function:
//
//   Integer Get_number_of_items(Dynamic_Integer list)
//
// If an inspector with reference parameters returns Integer, a non-zero result
// is treated as failure (the 12d convention) and shown instead of the members.
//
// A member whose type has inspectors of its own is expanded too (an Element's
// Model shows the Model's members), down to DBG12D_INSPECT_DEPTH levels.

import { TYPE_NAMES } from './types';

/** Types the runtime can write as text, and the dump function for each. */
export const PRINTABLE: Record<string, string> = {
  Integer: 'dbg12d_v_int',
  Integer64: 'dbg12d_v_int64',
  Real: 'dbg12d_v_real',
  Text: 'dbg12d_v_text',
  Uid: 'dbg12d_v_uid',
  Guid: 'dbg12d_v_guid',
};

/** Initial values, so out-parameters never hold garbage (12d leaves numbers uninitialised). */
const INITIAL: Record<string, string> = { Integer: '0', Integer64: '0', Real: '0.0', Text: '""' };

export const DEFAULT_INSPECTORS = [
  'Integer Get_name(Element elt, Text &name)',
  'Integer Get_type(Element elt, Integer &type)',
  'Integer Get_points(Element elt, Integer &points)',
  'Integer Get_model(Element elt, Model &model)',
  'Integer Get_name(Model model, Text &name)',
  'Integer Get_number_of_items(Model model, Integer &items)',
  // What is typed in panel fields.
  'Integer Get_data(Input_Box box, Text &value)',
  'Integer Get_data(Real_Box box, Text &value)',
  'Integer Get_data(Integer_Box box, Text &value)',
  'Integer Get_data(Model_Box box, Text &value)',
  'Integer Get_data(File_Box box, Text &value)',
  'Integer Get_data(Tick_Box box, Text &value)',
  'Integer Get_data(Named_Tick_Box box, Text &value)',
  'Integer Get_data(Message_Box box, Text &value)',
];

export type InspectorArg =
  | { kind: 'target' }
  | { kind: 'member'; type: string; name: string }
  | { kind: 'literal'; text: string };

export interface Inspector {
  signature: string;
  returnType: string;
  func: string;
  /** Type being inspected. */
  target: string;
  args: InspectorArg[];
}

export type InspectorTable = Map<string, Inspector[]>;

const IDENT = /^[A-Za-z_]\w*$/;

export function parseInspector(signature: string): Inspector {
  const fail = (why: string): never => { throw new Error(`Inspector "${signature}": ${why}`); };
  const m = /^\s*([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*\((.*)\)\s*;?\s*$/s.exec(signature);
  if (!m) fail('expected "<ReturnType> <Function>(<Type> <name>, <Type> &<member>, ...)"');
  const [, returnType, func, list] = m!;
  if (!TYPE_NAMES.has(returnType) && returnType !== 'void') fail(`unknown return type ${returnType}`);

  // Split on commas outside string literals.
  const parts: string[] = [];
  let cur = '';
  let inStr = false;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (inStr && c === '\\') { cur += c + (list[++i] ?? ''); continue; }
    if (c === '"') inStr = !inStr;
    if (c === ',' && !inStr) { parts.push(cur.trim()); cur = ''; } else cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  if (parts.length === 0) fail('needs at least the value being inspected as its first parameter');

  const args: InspectorArg[] = [];
  let target = '';
  parts.forEach((p, i) => {
    const decl = /^([A-Za-z_]\w*)\s*(&?)\s*([A-Za-z_]\w*)$/.exec(p.replace(/\s*&\s*/, ' &'));
    if (i === 0) {
      if (!decl || !TYPE_NAMES.has(decl[1])) fail(`first parameter "${p}" must be "<Type> <name>"`);
      target = decl![1];
      args.push({ kind: 'target' });
    } else if (decl && TYPE_NAMES.has(decl[1])) {
      if (!decl[2]) fail(`parameter "${p}" is not a reference; give a literal value instead, or make it &${decl[3]}`);
      args.push({ kind: 'member', type: decl[1], name: decl[3] });
    } else if (/^(-?[\d.]+(e-?\d+)?|"([^"\\]|\\.)*"|'.')$/i.test(p) || IDENT.test(p)) {
      // Numbers, strings, characters, or a #define'd constant.
      args.push({ kind: 'literal', text: p });
    } else {
      fail(`can't understand parameter "${p}"`);
    }
  });
  if (!args.some((a) => a.kind === 'member') && returnType === 'void') fail('returns nothing and has no & parameters');
  return { signature, returnType, func, target, args };
}

/**
 * Build the inspector table. User inspectors for a type replace the defaults
 * for that type; types the user didn't mention keep the defaults.
 */
export function resolveInspectors(user: string[] = []): InspectorTable {
  const table: InspectorTable = new Map();
  const add = (i: Inspector) => table.set(i.target, [...(table.get(i.target) ?? []), i]);
  const mine = user.map(parseInspector);
  const userTypes = new Set(mine.map((i) => i.target));
  for (const d of DEFAULT_INSPECTORS.map(parseInspector)) if (!userTypes.has(d.target)) add(d);
  mine.forEach(add);
  return table;
}

/**
 * Keep only the inspectors a program needs: the types it dumps, plus the
 * member types those expand into. Code for other types isn't generated, so
 * an inspector that doesn't compile only matters to programs that use its type.
 */
export function restrictInspectors(table: InspectorTable, used: Iterable<string>): InspectorTable {
  const keep: InspectorTable = new Map();
  const visit = (type: string) => {
    const list = table.get(type);
    if (!list || keep.has(type)) return;
    keep.set(type, list);
    for (const ins of list) {
      for (const a of ins.args) if (a.kind === 'member') visit(a.type);
      if (!ins.args.some((a) => a.kind === 'member')) visit(ins.returnType);
    }
  };
  for (const t of used) visit(t);
  return keep;
}

/** Name of the generated dump function for an inspected type. */
export const inspectFunction = (type: string) => `dbg12d_i_${type}`;

const lit = (s: string) => '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

function prototype(type: string): string {
  return `void ${inspectFunction(type)}(Text p_scope, Text p_name, ${type} &p_value, Integer p_depth)`;
}

/** Prototypes, placed in the runtime so instrumented code can call the dumps before they are defined. */
export function inspectorPrototypes(table: InspectorTable): string {
  return [...table.keys()].map((t) => prototype(t) + ';').join('\n');
}

/** One statement that writes a member (or recurses into it). */
function dumpMember(type: string, variable: string, name: string, table: InspectorTable): string {
  if (PRINTABLE[type]) return `${PRINTABLE[type]}(p_scope, ${name}, ${variable});`;
  if (table.has(type)) {
    return `if (p_depth < DBG12D_INSPECT_DEPTH) { ${inspectFunction(type)}(p_scope, ${name}, ${variable}, p_depth + 1); } ` +
      `else { dbg12d_v_line(p_scope, ${lit(type)}, ${name}, ""); }`;
  }
  return `dbg12d_v_line(p_scope, ${lit(type)}, ${name}, "");`;
}

/**
 * The dump functions themselves. These go at the end of the program so that
 * inspectors written in the macro's own code are already defined.
 */
export function generateInspectors(table: InspectorTable): string {
  const out: string[] = [
    '// ------------------------------------------------------------',
    '// dbg12d inspectors - generated by the 12dPL debugger. Do not edit.',
    '// ------------------------------------------------------------',
    '#ifndef DBG12D_INSPECTORS_INCLUDED',
    '#define DBG12D_INSPECTORS_INCLUDED',
    '',
  ];
  for (const [type, inspectors] of table) {
    out.push(prototype(type));
    out.push('{');
    out.push(`  dbg12d_v_line(p_scope, ${lit(type)}, p_name, "");`);
    out.push('  Integer l_rc = 0;');
    inspectors.forEach((ins, n) => {
      out.push(`  // ${ins.signature.replace(/\s+/g, ' ')}`);
      const members = ins.args.flatMap((a, k) => (a.kind === 'member' ? [{ ...a, local: `l_${n + 1}_${k}` }] : []));
      for (const mbr of members) {
        out.push(`  ${mbr.type} ${mbr.local}${INITIAL[mbr.type] ? ' = ' + INITIAL[mbr.type] : ''};`);
      }
      const callArgs = ins.args.map((a, k) =>
        a.kind === 'target' ? 'p_value' : a.kind === 'literal' ? a.text : `l_${n + 1}_${k}`).join(', ');
      const call = `${ins.func}(${callArgs})`;
      if (members.length === 0) {
        const local = `l_${n + 1}_r`;
        out.push(`  ${ins.returnType} ${local} = ${call};`);
        out.push(`  ${dumpMember(ins.returnType, local, `p_name + ".${ins.func}"`, table)}`);
        return;
      }
      const dumps = members.map((mbr) => dumpMember(mbr.type, mbr.local, `p_name + ".${mbr.name}"`, table));
      if (ins.returnType === 'Integer') {
        out.push(`  l_rc = ${call};`);
        out.push('  if (l_rc == 0) {');
        for (const d of dumps) out.push(`    ${d}`);
        out.push('  } else {');
        for (const mbr of members) {
          out.push(`    dbg12d_v_line(p_scope, "!", p_name + ".${mbr.name}", "${ins.func} returned " + To_text(l_rc));`);
        }
        out.push('  }');
      } else {
        out.push(`  ${call};`);
        for (const d of dumps) out.push(`  ${d}`);
      }
    });
    out.push('}');
    out.push('');
  }
  out.push('#endif');
  return out.join('\n') + '\n';
}

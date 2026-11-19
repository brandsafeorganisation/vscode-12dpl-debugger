#!/usr/bin/env python3
"""Turn the Draw UI panel macro into C++ so it can be run and drawn on Linux.

Usage: translate.py <base .4dm> <out .cpp>

Preprocesses with DRAW_PANEL_PREVIEW defined (so the original panel, whose
switches on Text and Get_id64() C++ can't compile, is left out; runtime.h
stands in for what it provides), removes the braces round global variables,
adds 1 to array sizes (12dPL arrays start at 1) and renames main.
Also lints for 12dPL pitfalls. Adapted from 12dpl-minecraft-macro's harness.
"""
import os, re, subprocess, sys

base, out = sys.argv[1], sys.argv[2]
pre = subprocess.run(['cpp', '-P', '-undef', '-nostdinc', '-x', 'c', '-w', '-DDRAW_PANEL_PREVIEW', os.path.basename(base)],
                     cwd=os.path.dirname(os.path.abspath(base)), capture_output=True, text=True)
if pre.returncode:
    print(pre.stderr)
    sys.exit(1)
code = pre.stdout


def strip_global_blocks(s):
    """Drop the { } round 12dPL global variable blocks, keeping strings and comments."""
    out, stack, i, n, last = [], [], 0, len(s), ''
    while i < n:
        c = s[i]
        if c in '"\'':
            j = i + 1
            while j < n and s[j] != c:
                if s[j] == '\\':
                    j += 1
                j += 1
            out.append(s[i:j + 1]); i = j + 1; last = c; continue
        if s.startswith('//', i):
            j = s.find('\n', i); j = n if j < 0 else j
            out.append(s[i:j]); i = j; continue
        if s.startswith('/*', i):
            j = s.find('*/', i) + 2
            out.append(s[i:j]); i = j; continue
        if c == '{':
            is_global = not stack and last != ')'
            stack.append(is_global)
            if not is_global:
                out.append(c)
            last = '{'; i += 1; continue
        if c == '}':
            if not stack.pop():
                out.append(c)
            last = '}'; i += 1; continue
        if not c.isspace():
            last = c
        out.append(c); i += 1
    return ''.join(out)


code = strip_global_blocks(code)
code = re.sub(r'^(\s*(?:Integer|Real|Text|Integer64)\s+\w+\s*)\[([^\]]+)\](\s*(?:=[^;]*)?;)', r'\1[(\2)+1]\3', code, flags=re.M)
code = re.sub(r'\bvoid\s+main\s*\(\s*\)', 'void macro_main()', code)
open(out, 'w').write('#include "runtime.h"\n' + code + '\n')

# ------------------------------------------------------------------ lint
problems = []
for k, line in enumerate(code.split('\n')):
    t = re.sub(r'"(\\.|[^"\\])*"', '""', line).split('//')[0]
    if re.search(r'\?[^:]*:', t):
        problems.append(f'{k + 1}: ternary ?: {line.strip()}')
    lits = list(re.finditer(r'"(?:\\.|[^"\\])*"', line))
    for a, b in zip(lits, lits[1:]):
        if re.fullmatch(r'\s*\+\s*', line[a.end():b.start()]):
            problems.append(f'{k + 1}: literal + literal: {line.strip()}')

# per function: duplicate declarations, names clashing with functions, prefixes
func_re = re.compile(r'^(?:void|Integer|Real|Text|Integer64)\s+(\w+)\s*\(([^)]*)\)\s*$', re.M)
funcs = set(m.group(1) for m in func_re.finditer(code))
decl_re = re.compile(r'\b(Integer|Real|Text|Integer64|Attributes|Dynamic_Text|Draw_Box|Panel|Input_Box|Message_Box|Vertical_Group)\s+&?\s*(\w+)\s*(?:=|;|\[|,|\))')
for m in func_re.finditer(code):
    name = m.group(1)
    start = code.find('{', m.end())
    depth, j = 0, start
    while True:
        if code[j] == '{':
            depth += 1
        elif code[j] == '}':
            depth -= 1
            if depth == 0:
                break
        j += 1
    if not name.startswith(('dui_', 'ddp_', 'show_draw_panel')):
        continue  # only lint the Draw UI code
    seen = {}
    for d in decl_re.finditer(m.group(2) + ','):
        seen[d.group(2)] = 1
        if not d.group(2).startswith('p_'):
            problems.append(f'{name}: parameter {d.group(2)} should start with p_')
    body = re.sub(r'//[^\n]*', '', re.sub(r'"(\\.|[^"\\])*"', '""', code[start:j]))
    for d in decl_re.finditer(body):
        v = d.group(2)
        if v in seen:
            problems.append(f'{name}: {v} declared twice')
        if not v.startswith(('l_', 'p_', 'g_')):
            problems.append(f'{name}: local {v} should start with l_')
        if v in funcs:
            problems.append(f'{name}: variable {v} has the name of a function')
        seen[v] = 1
    # every non-void function must end with a return
    if not code[m.start():m.end()].startswith('void'):
        last = [s for s in re.split(r'[;}]', body) if s.strip()]
        if not last or not last[-1].strip().lstrip('{').strip().startswith('return'):
            problems.append(f'{name}: does not end with a return')

for p in problems:
    print('LINT', p)
print('lint problems:', len(problems))

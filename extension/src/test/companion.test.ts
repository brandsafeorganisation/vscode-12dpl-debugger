import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..', '..');

test('the companion macro is copied into the extension so it ships in the .vsix', () => {
  const shipped = path.join(root, 'companion', 'compile_debug_macro_panel.4dm');
  const source = path.join(root, '..', 'companions', 'compile_debug_macro_panel.4dm');
  assert.ok(fs.existsSync(shipped), 'run the build first');
  assert.equal(fs.readFileSync(shipped, 'utf8'), fs.readFileSync(source, 'utf8'));
  assert.doesNotMatch(fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8'), /^companion/m);
});

test('the companion macro opens this extension', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const macro = fs.readFileSync(path.join(root, 'companion', 'compile_debug_macro_panel.4dm'), 'utf8');
  const id = `${pkg.publisher}.${pkg.name}`.toLowerCase();
  assert.match(macro, new RegExp(`"vscode://${id.replace(/\./g, '\\.')}/debug\\?request="`));
});

test('compilerPath defaults to the standard 12d install', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.contributes.configuration.properties['12dpl.compilerPath'].default,
    'C:\\Program Files\\12d\\12dmodel\\15.00\\nt.x64\\cc4d.exe');
});

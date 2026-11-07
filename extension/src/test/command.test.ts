import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { compileArgv, splitCommand } from '../adapter/command';

test('compileCommand is split without a shell', () => {
  assert.deepEqual(
    splitCommand('"C:\\Program Files\\12d\\cc4d.exe"  -x "${file}" ""'),
    ['C:\\Program Files\\12d\\cc4d.exe', '-x', '${file}', '']);
  // Paths with spaces substituted after splitting stay one argument.
  assert.deepEqual(compileArgv('cc4d.exe ${file}', 'C:/my macros/a.4dm', 'o'), ['cc4d.exe', 'C:/my macros/a.4dm']);
  assert.deepEqual(compileArgv(['cc4d.exe', '-o', '${outDir}'], 'f', 'C:/out dir'), ['cc4d.exe', '-o', 'C:/out dir']);
});

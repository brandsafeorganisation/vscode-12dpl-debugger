import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { compilerCpath, defaultCompilerCpath } from '../compilerEnv';

const CC4D = 'C:\\Program Files\\12d\\12dmodel\\15.00\\nt.x64\\cc4d.exe';

test('CPATH for cc4d is worked out from where it is installed', () => {
  assert.equal(defaultCompilerCpath(CC4D),
    'c:\\12d\\15.00\\user_lib:c:\\12d\\15.00\\user:' +
    'C:\\Program Files\\12d\\12dmodel\\15.00\\library:C:\\Program Files\\12d\\12dmodel\\15.00\\set_ups');
});

test('the setting wins, then CPATH from the environment', () => {
  assert.equal(compilerCpath(CC4D, 'd:\\mine', { CPATH: 'e:\\env' }), 'd:\\mine');
  assert.equal(compilerCpath(CC4D, '', { CPATH: 'e:\\env' }), 'e:\\env');
  assert.equal(compilerCpath(CC4D, undefined, {}), defaultCompilerCpath(CC4D));
});

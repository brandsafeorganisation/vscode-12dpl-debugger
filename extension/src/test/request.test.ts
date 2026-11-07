import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseRequest, splitPathList } from '../adapter/request';

const CPATH = 'c:\\12d\\15.00\\user_lib:c:\\12d\\15.00\\user:C:\\Program Files\\12d\\12dmodel\\15.00\\library:C:\\Program Files\\12d\\12dmodel\\15.00\\set_ups';
const FOLDERS = [
  'c:\\12d\\15.00\\user_lib',
  'c:\\12d\\15.00\\user',
  'C:\\Program Files\\12d\\12dmodel\\15.00\\library',
  'C:\\Program Files\\12d\\12dmodel\\15.00\\set_ups',
];

test('12d path lists split on ":" but not on drive letters', () => {
  assert.deepEqual(splitPathList(CPATH), FOLDERS);
  assert.deepEqual(splitPathList('C:/a;D:/b'), ['C:/a', 'D:/b']);
});

test('request file: program, 12d variables, CPATH or its parts', () => {
  const r = parseRequest(`\uFEFFC:\\macros\\main.4dm\r\nCPATH=${CPATH}\r\nUSER_4D=c:\\12d\\15.00\\user\r\nLIB_4D=\r\n`);
  assert.equal(r.program, 'C:\\macros\\main.4dm');
  assert.deepEqual(r.cpath, FOLDERS);
  assert.equal(r.env.USER_4D, 'c:\\12d\\15.00\\user');
  assert.equal(r.env.LIB_4D, undefined);

  // Without CPATH, the same order is built from the *_4D variables.
  const built = parseRequest([
    'main.4dm',
    `SET_UPS_4D=${FOLDERS[3]}`, `USER_4D=${FOLDERS[1]}`, `LIB_4D=${FOLDERS[2]}`, `USER_LIB_4D=${FOLDERS[0]}`,
  ].join('\n'));
  assert.deepEqual(built.cpath, FOLDERS);
  // Old companions sent only the path.
  assert.deepEqual(parseRequest('main.4dm\n'), { program: 'main.4dm', env: {}, cpath: [] });
});

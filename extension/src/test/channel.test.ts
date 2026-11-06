import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { decode, parseMessage } from '../adapter/channel';

test('decodes UTF-8 with BOM (File_open with ccs=UTF-8), UTF-16 and ANSI', () => {
  const text = 'stopped step\r\nvar L Text l_note café ✓\r\nend\r\n';
  assert.equal(decode(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')])), text);
  assert.equal(decode(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])), text);
  assert.equal(decode(Buffer.from('caf\xe9', 'latin1')), 'café');
});

test('parses a stop message, including multi-line Text values', () => {
  const m = parseMessage('stopped breakpoint\r\nframe 2 7 helper\r\nframe 1 16 main\r\nvar L Text t line one\r\nline two\r\nvar G Integer g 3\r\nend\r\n');
  assert.deepEqual(m, {
    kind: 'stopped',
    reason: 'breakpoint',
    frames: [{ file: 2, line: 7, name: 'helper' }, { file: 1, line: 16, name: 'main' }],
    variables: [
      { scope: 'L', type: 'Text', name: 't', value: 'line one\nline two' },
      { scope: 'G', type: 'Integer', name: 'g', value: '3' },
    ],
  });
});

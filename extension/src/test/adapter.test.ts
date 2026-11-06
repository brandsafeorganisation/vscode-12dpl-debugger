// End-to-end: start the real debug adapter process, drive it over DAP the way
// VS Code does, and play the 12d side with FakeMacro.

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FakeMacro } from './fakeMacro';

class DapClient {
  private seq = 1;
  private buf = Buffer.alloc(0);
  private waiters: { match: (m: any) => boolean; resolve: (m: any) => void }[] = [];
  private backlog: any[] = [];
  readonly output: string[] = [];

  constructor(private readonly proc: cp.ChildProcessWithoutNullStreams) {
    proc.stdout.on('data', (d: Buffer) => {
      this.buf = Buffer.concat([this.buf, d]);
      for (;;) {
        const sep = this.buf.indexOf('\r\n\r\n');
        if (sep < 0) return;
        const len = Number(/Content-Length: (\d+)/.exec(this.buf.subarray(0, sep).toString())![1]);
        if (this.buf.length < sep + 4 + len) return;
        const msg = JSON.parse(this.buf.subarray(sep + 4, sep + 4 + len).toString());
        this.buf = this.buf.subarray(sep + 4 + len);
        if (msg.type === 'event' && msg.event === 'output') this.output.push(msg.body.output);
        const w = this.waiters.findIndex((x) => x.match(msg));
        if (w >= 0) this.waiters.splice(w, 1)[0].resolve(msg);
        else this.backlog.push(msg);
      }
    });
  }

  wait(match: (m: any) => boolean, timeoutMs = 5000): Promise<any> {
    const i = this.backlog.findIndex(match);
    if (i >= 0) return Promise.resolve(this.backlog.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timed out; output so far:\n' + this.output.join(''))), timeoutMs);
      this.waiters.push({ match, resolve: (m) => { clearTimeout(t); resolve(m); } });
    });
  }

  event(name: string) { return this.wait((m) => m.type === 'event' && m.event === name); }

  request(command: string, args?: unknown): Promise<any> {
    const seq = this.seq++;
    const json = JSON.stringify({ seq, type: 'request', command, arguments: args });
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
    return this.wait((m) => m.type === 'response' && m.request_seq === seq).then((r) => {
      if (!r.success) throw new Error(`${command} failed: ${r.message}`);
      return r.body;
    });
  }
}

const MACRO = [
  '{',                                  // 1
  '  Integer g_count;',                 // 2
  '}',                                  // 3
  '',                                   // 4
  'Integer helper(Integer p_x)',        // 5
  '{',                                  // 6
  '  Integer l_y = p_x * 2;',           // 7
  '  g_count = g_count + 1;',           // 8
  '  return l_y;',                      // 9
  '}',                                  // 10
  '',                                   // 11
  'void main()',                        // 12
  '{',                                  // 13
  '  Integer l_a = 1;',                 // 14
  '  Panel   l_panel; Element l_elt;',  // 15
  '  l_a = helper(l_a);',               // 16
  '  Print(l_a);',                      // 17
  '}',                                  // 18
].join('\n');

test('launch, breakpoints, stepping, variables, exit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-e2e-'));
  const program = path.join(dir, 'main.4dm');
  const outDir = path.join(dir, 'out');
  fs.writeFileSync(program, MACRO);

  const proc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'adapter', 'main.js')]);
  const dap = new DapClient(proc);
  try {
    await dap.request('initialize', { adapterID: '12dpl', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path' });
    await dap.event('initialized');
    // Breakpoint on blank line 4 can't be placed; line 7 can.
    const launched = dap.request('launch', { program, outDir, stopOnEntry: true, pollIntervalMs: 10 });
    // VS Code sends launch before setBreakpoints, so these are verified straight away.
    const early = await dap.request('setBreakpoints', { source: { path: program }, breakpoints: [{ line: 7 }] });
    assert.deepEqual([early.breakpoints[0].verified, early.breakpoints[0].line], [true, 7]);
    await dap.request('configurationDone');
    await launched;

    // Breakpoints set after launch are verified and snapped.
    const bps = await dap.request('setBreakpoints', { source: { path: program }, breakpoints: [{ line: 6 }, { line: 18 }] });
    assert.deepEqual(bps.breakpoints.map((b: any) => [b.verified, b.line]), [[true, 7], [false, 18]]);

    // The adapter wrote the instrumented program and runtime; read the session dir from it.
    const runtime = fs.readFileSync(path.join(outDir, 'dbg12d_runtime.4dm'), 'utf8');
    const sessionDir = /#define DBG12D_DIR\s+"([^"]+)"/.exec(runtime)![1];
    assert.match(fs.readFileSync(path.join(outDir, 'main.4dm'), 'utf8'), /^#include "[^"]*\/dbg12d_runtime.4dm"\n/);
    assert.match(fs.readFileSync(path.join(outDir, 'dbg12d_inspectors.4dm'), 'utf8'), /Get_name\(p_value, /);

    const macro = new FakeMacro(sessionDir);
    const g = (v: string) => ['G', 'Integer', 'g_count', v] as ['G', string, string, string];
    const done = macro.run([
      { enter: 'main', file: 1, line: 12 },
      { hit: 14, file: 1, vars: [g('0')] },
      { hit: 15, file: 1, vars: [['L', 'Integer', 'l_a', '1'], g('0')] },
      { hit: 16, file: 1, vars: [['L', 'Integer', 'l_a', '1'], g('0')] },
      { enter: 'helper', file: 1, line: 5 },
      { hit: 7, file: 1, vars: [['L', 'Integer', 'p_x', '1'], g('0')] },
      { hit: 8, file: 1, vars: [['L', 'Integer', 'p_x', '1'], ['L', 'Integer', 'l_y', '2'], g('0')] },
      { hit: 9, file: 1, vars: [['L', 'Integer', 'p_x', '1'], ['L', 'Integer', 'l_y', '2'], g('1')] },
      { leave: true },
      { hit: 17, file: 1, vars: [
        ['L', 'Integer', 'l_a', '2'],
        ['L', 'Element', 'l_elt', ''],
        ['L', 'Text', 'l_elt.name', 'kerb'],
        ['L', '!', 'l_elt.points', 'Get_points returned 3'],
        ['L', 'Model', 'l_elt.model', ''],
        ['L', 'Text', 'l_elt.model.name', 'design'],
        g('1'),
      ] },
      { leave: true },
    ]);

    // stopOnEntry
    let stopped = await dap.event('stopped');
    assert.equal(stopped.body.reason, 'entry');
    let st = await dap.request('stackTrace', { threadId: 1 });
    assert.deepEqual(st.stackFrames.map((f: any) => [f.name, f.line]), [['main', 14]]);
    assert.equal(st.stackFrames[0].source.path, program);

    // step over to 15, check locals (l_panel comes from metadata only after its declaration line)
    await dap.request('next', { threadId: 1 });
    stopped = await dap.event('stopped');
    assert.equal(stopped.body.reason, 'step');
    const scopes = await dap.request('scopes', { frameId: 0 });
    assert.deepEqual(scopes.scopes.map((s: any) => s.name), ['Locals', 'Globals']);
    let locals = await dap.request('variables', { variablesReference: scopes.scopes[0].variablesReference });
    assert.deepEqual(locals.variables.map((v: any) => [v.name, v.value]), [['l_a', '1']]);

    await dap.request('next', { threadId: 1 });
    await dap.event('stopped');
    locals = await dap.request('variables', { variablesReference: 1 });
    assert.deepEqual(locals.variables.map((v: any) => [v.name, v.value]), [['l_a', '1'], ['l_panel', '<Panel>'], ['l_elt', '<Element>']]);
    const globals = await dap.request('variables', { variablesReference: 2 });
    assert.deepEqual(globals.variables.map((v: any) => [v.name, v.value]), [['g_count', '0']]);
    const hover = await dap.request('evaluate', { expression: 'l_a', frameId: 0, context: 'hover' });
    assert.equal(hover.result, '1');

    // continue -> breakpoint in helper with two frames
    await dap.request('continue', { threadId: 1 });
    stopped = await dap.event('stopped');
    assert.equal(stopped.body.reason, 'breakpoint');
    st = await dap.request('stackTrace', { threadId: 1 });
    assert.deepEqual(st.stackFrames.map((f: any) => [f.name, f.line]), [['helper', 7], ['main', 16]]);
    assert.deepEqual((await dap.request('scopes', { frameId: 1 })).scopes, []);

    // step out -> back in main at the next line
    await dap.request('stepOut', { threadId: 1 });
    await dap.event('stopped');
    st = await dap.request('stackTrace', { threadId: 1 });
    assert.deepEqual(st.stackFrames.map((f: any) => [f.name, f.line]), [['main', 17]]);
    locals = await dap.request('variables', { variablesReference: 1 });
    assert.deepEqual(locals.variables.map((v: any) => [v.name, v.value]), [
      ['l_a', '2'], ['l_panel', '<Panel>'],
      ['l_elt', 'Element {name: "kerb", points: <Get_points returned 3>, model: Model {name: "design"}}'],
    ]);
    // Inspected values expand into their members, recursively.
    const elt = locals.variables[2];
    const members = await dap.request('variables', { variablesReference: elt.variablesReference });
    assert.deepEqual(members.variables.map((v: any) => [v.name, v.value, v.evaluateName]), [
      ['name', '"kerb"', 'l_elt.name'],
      ['points', '<Get_points returned 3>', 'l_elt.points'],
      ['model', 'Model {name: "design"}', 'l_elt.model'],
    ]);
    const model = await dap.request('variables', { variablesReference: members.variables[2].variablesReference });
    assert.deepEqual(model.variables.map((v: any) => [v.name, v.value]), [['name', '"design"']]);
    assert.equal((await dap.request('evaluate', { expression: 'l_elt.model.name', frameId: 0, context: 'hover' })).result, '"design"');

    // run to the end
    await dap.request('continue', { threadId: 1 });
    await dap.event('terminated');
    await done;
    assert.equal(macro.terminated, false);
    // Both sides cleaned up after themselves.
    assert.deepEqual(fs.readdirSync(sessionDir), []);
  } finally {
    proc.kill();
  }
});

test('disconnect while paused terminates the macro', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-e2e-'));
  const program = path.join(dir, 'main.4dm');
  fs.writeFileSync(program, MACRO);
  const outDir = path.join(dir, 'out');
  const proc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'adapter', 'main.js')]);
  const dap = new DapClient(proc);
  try {
    await dap.request('initialize', { adapterID: '12dpl', pathFormat: 'path' });
    const launched = dap.request('launch', { program, outDir, stopOnEntry: true, pollIntervalMs: 10 });
    await dap.request('configurationDone');
    await launched;
    const sessionDir = path.join(outDir, 'session');
    const macro = new FakeMacro(sessionDir);
    const done = macro.run([{ enter: 'main', file: 1, line: 12 }, { hit: 14, file: 1 }, { hit: 15, file: 1 }, { leave: true }]);
    await dap.event('stopped');
    await dap.request('disconnect', {});
    await done;
    assert.equal(macro.terminated, true);
  } finally {
    proc.kill();
  }
});

test('refuses an outDir that contains the program', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbg12d-e2e-'));
  const program = path.join(dir, 'main.4dm');
  fs.writeFileSync(program, MACRO);
  const proc = cp.spawn(process.execPath, [path.join(__dirname, '..', 'adapter', 'main.js')]);
  const dap = new DapClient(proc);
  try {
    await dap.request('initialize', { adapterID: '12dpl', pathFormat: 'path' });
    await assert.rejects(dap.request('launch', { program, outDir: dir }), /must not contain the program/);
    assert.ok(fs.existsSync(program));
  } finally {
    proc.kill();
  }
});

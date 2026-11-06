// Stand-in for an instrumented macro running inside 12d Model. It speaks the
// same file protocol as instrumenter/runtime.ts and mirrors its stepping
// logic, so the adapter can be tested without 12d.

import * as fs from 'fs';
import * as path from 'path';

export type Step =
  | { enter: string; file: number; line: number }
  | { hit: number; file: number; vars?: [scope: 'L' | 'G', type: string, name: string, value: string][] }
  | { leave: true };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class FakeMacro {
  private mode = 0; // 0 run, 1 step in, 2 step over, 3 step out, 4 pause
  private target = 0;
  private inSeq = 0;
  private outSeq = 0;
  private bps: [number, number][] = [];
  private stack: { name: string; file: number; line: number }[] = [];
  terminated = false;

  constructor(private readonly dir: string) {}

  private write(lines: string[]) {
    this.outSeq++;
    const base = path.join(this.dir, `m2a_${this.outSeq}`);
    fs.writeFileSync(base + '.txt', lines.join('\r\n') + '\r\n');
    fs.writeFileSync(base + '.ready', 'ok\r\n');
  }

  private tryRead(): boolean {
    const base = path.join(this.dir, `a2m_${this.inSeq + 1}`);
    if (!fs.existsSync(base + '.ready')) return false;
    this.inSeq++;
    let resumed = false;
    for (const raw of fs.readFileSync(base + '.txt', 'latin1').split(/\r?\n/)) {
      const [cmd, a, b] = raw.trim().split(/\s+/);
      switch (cmd) {
        case 'bpclear': this.bps = []; break;
        case 'bp': this.bps.push([+a, +b]); break;
        case 'continue': this.mode = 0; resumed = true; break;
        case 'next': this.mode = 2; this.target = this.stack.length; resumed = true; break;
        case 'stepIn': this.mode = 1; resumed = true; break;
        case 'stepOut': this.mode = 3; this.target = this.stack.length; resumed = true; break;
        case 'pause': this.mode = 4; break;
        case 'terminate': this.terminated = true; return true;
      }
    }
    return resumed;
  }

  private async waitForResume() {
    while (!this.tryRead()) await sleep(5);
  }

  async run(steps: Step[]) {
    this.write(['started']);
    await this.waitForResume();
    for (const s of steps) {
      if (this.terminated) return;
      if ('enter' in s) {
        this.stack.push({ name: s.enter, file: s.file, line: s.line });
      } else if ('leave' in s) {
        this.stack.pop();
        if (this.stack.length === 0) { this.write(['exited']); return; }
      } else {
        const top = this.stack[this.stack.length - 1];
        top.file = s.file;
        top.line = s.hit;
        this.tryRead(); // async check (pause / breakpoint changes)
        const d = this.stack.length;
        let reason = '';
        if (this.mode === 1) reason = 'step';
        else if (this.mode === 2 && d <= this.target) reason = 'step';
        else if (this.mode === 3 && d < this.target) reason = 'step';
        else if (this.mode === 4) reason = 'pause';
        else if (this.bps.some(([f, l]) => f === s.file && l === s.hit)) reason = 'breakpoint';
        if (!reason) continue;
        const lines = [`stopped ${reason}`];
        for (let i = this.stack.length - 1; i >= 0; i--) {
          const f = this.stack[i];
          lines.push(`frame ${f.file} ${f.line} ${f.name}`);
        }
        for (const [scope, type, name, value] of s.vars ?? []) lines.push(`var ${scope} ${type} ${name} ${value}`);
        lines.push('end');
        this.write(lines);
        await this.waitForResume();
      }
    }
  }
}

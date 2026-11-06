// Adapter side of the file channel described in instrumenter/runtime.ts.

import * as fs from 'fs';
import * as path from 'path';

export interface Frame { file: number; line: number; name: string; }
export interface Variable { scope: 'L' | 'G'; type: string; name: string; value: string; }

export type MacroMessage =
  | { kind: 'started' }
  | { kind: 'exited' }
  | { kind: 'stopped'; reason: string; frames: Frame[]; variables: Variable[] }
  | { kind: 'unknown'; text: string };

/** Decode text written by 12d, which may be UTF-16 (with BOM), UTF-8 or ANSI. */
export function decode(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString('utf8');
  const utf8 = buf.toString('utf8');
  return utf8.includes('�') ? buf.toString('latin1') : utf8;
}

export function parseMessage(text: string): MacroMessage {
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const [head = '', ...rest] = lines;
  const [kind, ...args] = head.trim().split(/\s+/);
  if (kind === 'started' || kind === 'exited') return { kind };
  if (kind !== 'stopped') return { kind: 'unknown', text };

  const frames: Frame[] = [];
  const variables: Variable[] = [];
  let last: Variable | undefined;
  for (const line of rest) {
    let m: RegExpExecArray | null;
    if ((m = /^frame (\d+) (\d+) ?(.*)$/.exec(line))) {
      frames.push({ file: +m[1], line: +m[2], name: m[3] });
      last = undefined;
    } else if ((m = /^var ([LG]) (\S+) (\S+) ?(.*)$/.exec(line))) {
      last = { scope: m[1] as 'L' | 'G', type: m[2], name: m[3], value: m[4] };
      variables.push(last);
    } else if (line === 'end') {
      break;
    } else if (last) {
      // A Text value containing line breaks spills onto following lines.
      last.value += '\n' + line;
    }
  }
  return { kind: 'stopped', reason: args[0] ?? 'step', frames, variables };
}

export class FileChannel {
  private inSeq = 0;
  private outSeq = 0;
  private timer: NodeJS.Timeout | undefined;

  constructor(readonly dir: string, private readonly onMessage: (m: MacroMessage) => void, private readonly pollMs = 30) {}

  /** Empty the session folder and start listening. */
  start() {
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
    this.inSeq = 0;
    this.outSeq = 0;
    this.timer = setInterval(() => this.poll(), this.pollMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  send(lines: string[]) {
    this.outSeq++;
    const base = path.join(this.dir, `a2m_${this.outSeq}`);
    fs.writeFileSync(base + '.txt', lines.join('\r\n') + '\r\n', 'latin1');
    fs.writeFileSync(base + '.ready', 'ok\r\n');
  }

  private poll() {
    // Drain everything that is ready.
    for (;;) {
      const base = path.join(this.dir, `m2a_${this.inSeq + 1}`);
      if (!fs.existsSync(base + '.ready')) return;
      let buf: Buffer;
      try {
        buf = fs.readFileSync(base + '.txt');
      } catch {
        return; // try again next tick
      }
      this.inSeq++;
      for (const ext of ['.txt', '.ready']) fs.rmSync(base + ext, { force: true });
      this.onMessage(parseMessage(decode(buf)));
    }
  }
}

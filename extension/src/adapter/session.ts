import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  DebugSession, InitializedEvent, OutputEvent, Scope, Source, StackFrame, StoppedEvent,
  TerminatedEvent, Thread,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { INSPECTORS_FILE_NAME, instrumentProgram, InstrumentedFile, RUNTIME_FILE_NAME } from '../instrumenter/instrument';
import { generateInspectors, resolveInspectors, restrictInspectors } from '../instrumenter/inspectors';
import { generateRuntime } from '../instrumenter/runtime';
import { FileChannel, MacroMessage, Variable } from './channel';
import { compileArgv } from './command';

export interface LaunchArgs extends DebugProtocol.LaunchRequestArguments {
  program: string;
  outDir?: string;
  stopOnEntry?: boolean;
  /** Program and arguments, as one string (quote parts with spaces) or a list. Run without a shell. */
  compileCommand?: string | string[];
  pollIntervalMs?: number;
  /** Inspector signatures for non-text types, e.g. "Integer Get_name(Element elt, Text &name)". */
  inspectors?: string[];
  /** How many levels of inspector members to expand. */
  inspectDepth?: number;
  /** Extra folders to search for quoted #includes. */
  includePaths?: string[];
  /** Log every message to and from the macro in the Debug Console. */
  trace?: boolean;
  /**
   * Set when the companion macro started the session: once instrumented, the
   * result is written here (see writeReply) for the macro to pick up.
   */
  replyFile?: string;
}

/**
 * Answer the companion macro: "ok", the instrumented entry file and the
 * session folder, or "error" and a message. Written to a temporary name and
 * renamed, so the macro (which polls for the file) never reads half of it.
 */
export function writeReply(replyFile: string, lines: string[]) {
  const tmp = replyFile + '.tmp';
  fs.writeFileSync(tmp, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');
  fs.renameSync(tmp, replyFile);
}

const THREAD_ID = 1;
const LOCALS_REF = 1;
const GLOBALS_REF = 2;

type State = 'idle' | 'waitingForMacro' | 'running' | 'stopped' | 'exited';

export class TwelveDDebugSession extends DebugSession {
  private files: InstrumentedFile[] = [];
  private channel: FileChannel | undefined;
  private state: State = 'idle';
  private stopOnEntry = true;
  /** Breakpoints by file id (already snapped to instrumentable lines). */
  private breakpoints = new Map<number, number[]>();
  /** Breakpoints requested before launch, keyed by source path. */
  private pendingBreakpoints = new Map<string, DebugProtocol.SourceBreakpoint[]>();
  private hasStopped = false;
  private lastStop: Extract<MacroMessage, { kind: 'stopped' }> | undefined;
  private configurationDone: Promise<void>;
  private resolveConfigurationDone!: () => void;
  /** Expandable variables of the current stop: reference -> scope and name prefix. */
  private children = new Map<number, { scope: 'L' | 'G'; name: string }>();

  constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
    this.configurationDone = new Promise((r) => (this.resolveConfigurationDone = r));
  }

  // ---------------------------------------------------------------- helpers

  private log(text: string, category: 'console' | 'stdout' | 'stderr' | 'important' = 'console') {
    this.sendEvent(new OutputEvent(text.endsWith('\n') ? text : text + '\n', category));
  }

  private normalise(p: string) {
    const r = path.resolve(p);
    return process.platform === 'win32' ? r.toLowerCase() : r;
  }

  private fileForPath(p: string): InstrumentedFile | undefined {
    const n = this.normalise(p);
    return this.files.find((f) => this.normalise(f.source) === n);
  }

  /** Move a requested line to the first line at or after it that can stop. */
  private snap(file: InstrumentedFile, line: number): number | undefined {
    return file.breakpointLines.find((l) => l >= line);
  }

  private applyBreakpoints(sourcePath: string, requested: DebugProtocol.SourceBreakpoint[]): DebugProtocol.Breakpoint[] {
    const file = this.fileForPath(sourcePath);
    if (!file) {
      return requested.map((b) => ({ verified: false, line: b.line, message: 'This file is not part of the macro being debugged.' }));
    }
    const lines: number[] = [];
    const result = requested.map((b) => {
      const line = this.snap(file, b.line);
      if (line === undefined) return { verified: false, line: b.line, message: 'No statement on or after this line.' };
      lines.push(line);
      return { verified: true, line, source: this.sourceFor(file) };
    });
    this.breakpoints.set(file.id, lines);
    return result;
  }

  private breakpointCommands(): string[] {
    const out = ['bpclear'];
    for (const [id, lines] of this.breakpoints) for (const l of lines) out.push(`bp ${id} ${l}`);
    return out;
  }

  private sourceFor(file: InstrumentedFile): Source {
    return new Source(path.basename(file.source), file.source);
  }

  private trace = false;
  private sessionDir: string | undefined;

  private send(lines: string[]) {
    if (this.trace) this.log('to macro: ' + lines.join(' | '));
    this.channel?.send(lines);
  }

  // --------------------------------------------------------------- requests

  protected initializeRequest(response: DebugProtocol.InitializeResponse): void {
    response.body = {
      ...response.body,
      supportsConfigurationDoneRequest: true,
      supportsEvaluateForHovers: true,
      supportsTerminateRequest: true,
    };
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }

  protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse): void {
    this.resolveConfigurationDone();
    this.sendResponse(response);
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchArgs): Promise<void> {
    try {
      const program = path.resolve(args.program);
      const outDir = path.resolve(args.outDir ?? path.join(path.dirname(program), '.12dpl-debug'));
      const sessionDir = path.join(outDir, 'session');
      this.sessionDir = sessionDir;
      this.stopOnEntry = args.stopOnEntry ?? true;
      this.trace = args.trace ?? false;

      // outDir is wiped on every launch, so it must never hold the real sources.
      const rel = path.relative(outDir, program);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        throw new Error(`outDir (${outDir}) must not contain the program; it is deleted on every launch.`);
      }
      const allInspectors = resolveInspectors(args.inspectors ?? []);
      fs.rmSync(outDir, { recursive: true, force: true });
      const result = instrumentProgram(program, outDir, { inspectors: allInspectors, includePaths: args.includePaths });
      const inspectors = restrictInspectors(allInspectors, result.usedTypes);
      this.files = result.files;
      fs.writeFileSync(path.join(outDir, RUNTIME_FILE_NAME), generateRuntime({ sessionDir, inspectors, inspectDepth: args.inspectDepth }));
      fs.writeFileSync(path.join(outDir, INSPECTORS_FILE_NAME), generateInspectors(inspectors));
      for (const w of result.warnings) this.log('warning: ' + w, 'stderr');

      for (const [p, bps] of this.pendingBreakpoints) this.applyBreakpoints(p, bps);
      this.pendingBreakpoints.clear();

      this.channel = new FileChannel(sessionDir, (m) => {
        if (this.trace) this.log('from macro: ' + JSON.stringify(m));
        this.onMacroMessage(m);
      }, args.pollIntervalMs ?? 30);
      this.channel.start();
      this.state = 'waitingForMacro';

      this.log(`Instrumented ${result.files.length} file(s) into ${outDir}`);
      if (args.compileCommand) await this.compile(args.compileCommand, result.entryOutput, outDir);
      this.log(`Now compile and run this file in 12d Model:\n  ${result.entryOutput}\nWaiting for the macro to start...`, 'important');
      if (args.replyFile) writeReply(args.replyFile, ['ok', result.entryOutput, sessionDir]);

      await this.configurationDone;
      this.sendResponse(response);
    } catch (e) {
      const message = `Could not start: ${(e as Error).message}`;
      if (args.replyFile) {
        try { writeReply(args.replyFile, ['error', message]); } catch { /* the macro times out instead */ }
      }
      this.sendErrorResponse(response, 1, message);
    }
  }

  /**
   * Run the compiler directly (no shell: nothing goes through PowerShell or
   * cmd, so execution policies don't apply).
   */
  private compile(command: string | string[], file: string, outDir: string): Promise<void> {
    const [program, ...args] = compileArgv(command, file, outDir);
    if (!program) return Promise.resolve();
    this.log(`> ${[program, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`);
    if (process.platform === 'win32' && /\.(bat|cmd|ps1)$/i.test(program)) {
      this.log('compileCommand must be an .exe (such as cc4d.exe): .bat, .cmd and .ps1 files need a shell, which is not used.', 'stderr');
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const child = cp.spawn(program, args, { cwd: path.dirname(file), shell: false, windowsHide: true });
      child.stdout.on('data', (d) => this.log(String(d), 'stdout'));
      child.stderr.on('data', (d) => this.log(String(d), 'stderr'));
      child.on('close', (code) => {
        this.log(`compile command exited with code ${code}`);
        resolve();
      });
      child.on('error', (err) => {
        this.log(`compile command failed: ${err.message}`, 'stderr');
        resolve();
      });
    });
  }

  /** Called by VS Code when the debug session ends (inline adapter). */
  dispose() {
    this.channel?.stop();
    super.dispose();
  }

  protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
    const p = args.source.path ?? '';
    const requested = args.breakpoints ?? [];
    if (this.files.length === 0) {
      // Not launched yet; remember and report as unverified for now.
      this.pendingBreakpoints.set(p, requested);
      response.body = { breakpoints: requested.map((b) => ({ verified: false, line: b.line })) };
    } else {
      response.body = { breakpoints: this.applyBreakpoints(p, requested) };
      if (this.state === 'running' || this.state === 'stopped') this.send(this.breakpointCommands());
    }
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(THREAD_ID, '12d macro')] };
    this.sendResponse(response);
  }

  protected stackTraceRequest(response: DebugProtocol.StackTraceResponse): void {
    const frames = this.lastStop?.frames ?? [];
    response.body = {
      stackFrames: frames.map((f, i) => {
        const file = this.files.find((x) => x.id === f.file);
        return new StackFrame(i, f.name, file ? this.sourceFor(file) : undefined, f.line);
      }),
      totalFrames: frames.length,
    };
    this.sendResponse(response);
  }

  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
    // Variables are only captured for the innermost frame.
    response.body = {
      scopes: args.frameId === 0
        ? [new Scope('Locals', LOCALS_REF, false), new Scope('Globals', GLOBALS_REF, false)]
        : [],
    };
    this.sendResponse(response);
  }

  /** Direct members of an inspected variable (names "<parent>.<member>"). */
  private membersOf(scope: 'L' | 'G', parent: string): Variable[] {
    const prefix = parent + '.';
    return (this.lastStop?.variables ?? []).filter(
      (v) => v.scope === scope && v.name.startsWith(prefix) && !v.name.slice(prefix.length).includes('.'));
  }

  /** Value as shown in VS Code; inspected values summarise their members. */
  private formatValue(v: Variable): string {
    if (v.type === '!') return `<${v.value}>`;
    if (v.type === 'Text') return JSON.stringify(v.value);
    if (v.value !== '') return v.value;
    const members = this.membersOf(v.scope, v.name);
    if (members.length === 0) return `<${v.type}>`;
    let summary = members.map((m) => `${m.name.slice(v.name.length + 1)}: ${this.formatValue(m)}`).join(', ');
    if (summary.length > 120) summary = summary.slice(0, 117) + '...';
    return `${v.type} {${summary}}`;
  }

  private toDap(v: Variable): DebugProtocol.Variable {
    const members = v.value === '' ? this.membersOf(v.scope, v.name) : [];
    const shortName = v.name.slice(v.name.lastIndexOf('.') + 1);
    if (members.length === 0) {
      return { name: shortName, value: this.formatValue(v), type: v.type, variablesReference: 0, evaluateName: v.name };
    }
    let ref = [...this.children].find(([, c]) => c.scope === v.scope && c.name === v.name)?.[0];
    if (ref === undefined) {
      ref = this.children.size + 3;
      this.children.set(ref, { scope: v.scope, name: v.name });
    }
    return {
      name: shortName, value: this.formatValue(v), type: v.type,
      variablesReference: ref, namedVariables: members.length, evaluateName: v.name,
    };
  }

  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
    const ref = args.variablesReference;
    let vars: Variable[];
    if (ref === LOCALS_REF || ref === GLOBALS_REF) {
      const scope = ref === LOCALS_REF ? 'L' : 'G';
      vars = (this.lastStop?.variables ?? []).filter((v) => v.scope === scope && !v.name.includes('.'));
    } else {
      const parent = this.children.get(ref);
      vars = parent ? this.membersOf(parent.scope, parent.name) : [];
    }
    response.body = { variables: vars.map((v) => this.toDap(v)) };
    this.sendResponse(response);
  }

  protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
    const name = args.expression.trim();
    const vars = this.lastStop?.variables ?? [];
    const v = vars.find((x) => x.name === name && x.scope === 'L') ?? vars.find((x) => x.name === name);
    if (v && (args.frameId === undefined || args.frameId === 0)) {
      const d = this.toDap(v);
      response.body = { result: d.value, type: d.type, variablesReference: d.variablesReference, namedVariables: d.namedVariables };
      this.sendResponse(response);
    } else {
      this.sendErrorResponse(response, 2, args.context === 'hover' ? '' : `Only captured variable names can be evaluated (no "${name}").`);
    }
  }

  private resume(response: DebugProtocol.Response, command: string) {
    if (this.state !== 'stopped') {
      this.sendErrorResponse(response, 3, 'The macro is not paused.');
      return;
    }
    this.state = 'running';
    this.lastStop = undefined;
    this.children.clear();
    this.send([command]);
    this.sendResponse(response);
  }

  protected continueRequest(response: DebugProtocol.ContinueResponse): void {
    response.body = { allThreadsContinued: true };
    this.resume(response, 'continue');
  }
  protected nextRequest(response: DebugProtocol.NextResponse): void { this.resume(response, 'next'); }
  protected stepInRequest(response: DebugProtocol.StepInResponse): void { this.resume(response, 'stepIn'); }
  protected stepOutRequest(response: DebugProtocol.StepOutResponse): void { this.resume(response, 'stepOut'); }

  protected pauseRequest(response: DebugProtocol.PauseResponse): void {
    if (this.state === 'running') this.send(['pause']);
    this.sendResponse(response);
  }

  protected terminateRequest(response: DebugProtocol.TerminateResponse): void {
    this.shutdown();
    this.sendResponse(response);
  }

  protected disconnectRequest(response: DebugProtocol.DisconnectResponse): void {
    this.shutdown();
    this.sendResponse(response);
  }

  shutdown() {
    // Also when the macro hasn't started yet: a debug build run after the
    // session has ended then stops straight away rather than running blind.
    if (this.state === 'running' || this.state === 'stopped' || this.state === 'waitingForMacro') this.send(['terminate']);
    this.state = 'exited';
    // The macro removes its lock when it sees terminate; if it died instead
    // (a 12d error), nothing else would.
    if (this.sessionDir) fs.rmSync(path.join(this.sessionDir, 'macro.lock'), { force: true });
    // Give the macro a moment to see the terminate message before we stop listening.
    setTimeout(() => this.channel?.stop(), 200);
  }

  // ------------------------------------------------------- macro messages

  /** Fill in variables whose type has no text form, from the instrumenter's metadata. */
  private addUncapturedVariables(m: Extract<MacroMessage, { kind: 'stopped' }>) {
    const top = m.frames[0];
    const file = top && this.files.find((f) => f.id === top.file);
    const known = file?.variables[top.line];
    if (!known) return;
    const sent = new Map(m.variables.map((v) => [v.scope + ' ' + v.name, v]));
    m.variables = [
      ...known.map((k) =>
        sent.get(k.scope + ' ' + k.name) ?? { scope: k.scope, type: k.type + (k.isArray ? '[]' : ''), name: k.name, value: '' }),
      // Members of inspected values.
      ...m.variables.filter((v) => v.name.includes('.')),
    ];
  }

  private onMacroMessage(m: MacroMessage) {
    switch (m.kind) {
      case 'started':
        this.log('Macro started.');
        this.state = 'running';
        this.send([...this.breakpointCommands(), this.stopOnEntry ? 'stepIn' : 'continue']);
        break;
      case 'stopped':
        this.addUncapturedVariables(m);
        this.lastStop = m;
        this.children.clear();
        this.state = 'stopped';
        this.sendEvent(new StoppedEvent(m.reason === 'step' && this.stopOnEntry && !this.hasStopped ? 'entry' : m.reason, THREAD_ID));
        this.hasStopped = true;
        break;
      case 'exited':
        this.log('Macro finished.');
        this.state = 'exited';
        this.channel?.stop();
        this.sendEvent(new TerminatedEvent());
        break;
      default:
        this.log(`Unrecognised message from macro: ${m.text}`, 'stderr');
    }
  }
}

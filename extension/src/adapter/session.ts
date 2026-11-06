import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  DebugSession, InitializedEvent, OutputEvent, Scope, Source, StackFrame, StoppedEvent,
  TerminatedEvent, Thread,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { instrumentProgram, InstrumentedFile, RUNTIME_FILE_NAME } from '../instrumenter/instrument';
import { generateRuntime } from '../instrumenter/runtime';
import { FileChannel, MacroMessage, Variable } from './channel';

export interface LaunchArgs extends DebugProtocol.LaunchRequestArguments {
  program: string;
  outDir?: string;
  stopOnEntry?: boolean;
  compileCommand?: string;
  pollIntervalMs?: number;
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

  private send(lines: string[]) {
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
      this.stopOnEntry = args.stopOnEntry ?? true;

      // outDir is wiped on every launch, so it must never hold the real sources.
      const rel = path.relative(outDir, program);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        throw new Error(`outDir (${outDir}) must not contain the program; it is deleted on every launch.`);
      }
      fs.rmSync(outDir, { recursive: true, force: true });
      const result = instrumentProgram(program, outDir);
      this.files = result.files;
      fs.writeFileSync(path.join(outDir, RUNTIME_FILE_NAME), generateRuntime({ sessionDir }));
      for (const w of result.warnings) this.log('warning: ' + w, 'stderr');

      for (const [p, bps] of this.pendingBreakpoints) this.applyBreakpoints(p, bps);
      this.pendingBreakpoints.clear();

      this.channel = new FileChannel(sessionDir, (m) => this.onMacroMessage(m), args.pollIntervalMs ?? 30);
      this.channel.start();
      this.state = 'waitingForMacro';

      this.log(`Instrumented ${result.files.length} file(s) into ${outDir}`);
      if (args.compileCommand) await this.compile(args.compileCommand, result.entryOutput, outDir);
      this.log(`Now compile and run this file in 12d Model:\n  ${result.entryOutput}\nWaiting for the macro to start...`, 'important');

      await this.configurationDone;
      this.sendResponse(response);
    } catch (e) {
      this.sendErrorResponse(response, 1, `Could not start: ${(e as Error).message}`);
    }
  }

  private compile(command: string, file: string, outDir: string): Promise<void> {
    const cmd = command.replace(/\$\{file\}/g, file).replace(/\$\{outDir\}/g, outDir);
    this.log(`> ${cmd}`);
    return new Promise((resolve) => {
      const child = cp.spawn(cmd, { shell: true, cwd: path.dirname(file) });
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

  private toDap(v: Variable): DebugProtocol.Variable {
    const value = v.type === 'Text' ? JSON.stringify(v.value) : v.value === '' ? `<${v.type}>` : v.value;
    return { name: v.name, value, type: v.type, variablesReference: 0 };
  }

  protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
    const scope = args.variablesReference === LOCALS_REF ? 'L' : 'G';
    const vars = (this.lastStop?.variables ?? []).filter((v) => v.scope === scope);
    response.body = { variables: vars.map((v) => this.toDap(v)) };
    this.sendResponse(response);
  }

  protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
    const name = args.expression.trim();
    const vars = this.lastStop?.variables ?? [];
    const v = vars.find((x) => x.name === name && x.scope === 'L') ?? vars.find((x) => x.name === name);
    if (v && (args.frameId === undefined || args.frameId === 0)) {
      const d = this.toDap(v);
      response.body = { result: d.value, type: d.type, variablesReference: 0 };
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
    if (this.state === 'running' || this.state === 'stopped') this.send(['terminate']);
    this.state = 'exited';
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
    m.variables = known.map((k) =>
      sent.get(k.scope + ' ' + k.name) ?? { scope: k.scope, type: k.type + (k.isArray ? '[]' : ''), name: k.name, value: '' });
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

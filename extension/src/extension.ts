import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TwelveDDebugSession, writeReply } from './adapter/session';
import { decode } from './adapter/channel';
import { parseRequest } from './adapter/request';

/** Launch settings that can also come from the Settings editor (12dpl.*). */
const SETTINGS = ['stopOnEntry', 'inspectors', 'inspectDepth', 'includePaths', 'compileCommand', 'trace'] as const;

/** 12dPL debug sessions that have started and not yet ended. */
const sessions = new Set<vscode.DebugSession>();

function active12dSession(): vscode.DebugSession | undefined {
  return sessions.values().next().value;
}

/**
 * vscode://georgegunter.12dpl-debugger/debug?request=<file>
 *
 * Sent by the companion macro (companions/compile_debug_macro_panel.4dm)
 * through Shell_execute. <file> holds the path of the macro to debug and
 * 12d's environment (see adapter/request.ts); the answer goes to
 * <file>.reply (see writeReply in adapter/session.ts).
 *
 * This is the only way a 12dPL debug session starts: the macro starts the
 * debugger, not the other way round.
 */
async function handleUri(uri: vscode.Uri) {
  if (uri.path !== '/debug') return;
  const request = new URLSearchParams(uri.query).get('request');
  if (!request) return;
  const reply = request + '.reply';
  const fail = (message: string) => {
    writeReply(reply, ['error', message]);
    vscode.window.showErrorMessage(`12dPL debugger: ${message}`);
  };
  try {
    const { program, cpath } = parseRequest(decode(fs.readFileSync(request)));
    if (!program || !fs.existsSync(program)) return fail(`Macro not found: ${program}`);

    // Only one session at a time: a second would wipe the first one's files.
    const running = active12dSession();
    if (running) {
      return fail(`A debug session (${running.name}) is already running in VS Code. Stop it there first.`);
    }

    const doc = await vscode.workspace.openTextDocument(program);
    await vscode.window.showTextDocument(doc, { preview: false });
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    const started = await vscode.debug.startDebugging(folder, {
      type: '12dpl',
      request: 'launch',
      name: `Debug ${path.basename(program)} (from 12d)`,
      program,
      replyFile: reply,
      cpath,
    });
    // On success the adapter writes the reply itself, once it is listening.
    if (!started && !fs.existsSync(reply)) fail('VS Code could not start the debug session; see the Debug Console.');
  } catch (e) {
    fail((e as Error).message);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Run the debug adapter inside the extension host. No process is started and
  // no shell is involved, so it works where PowerShell scripts, cmd or
  // ELECTRON_RUN_AS_NODE are locked down. (out/adapter/main.js still runs the
  // same adapter as a standalone process, for tests and debugging it.)
  const factory: vscode.DebugAdapterDescriptorFactory = {
    createDebugAdapterDescriptor(): vscode.DebugAdapterDescriptor {
      return new vscode.DebugAdapterInlineImplementation(new TwelveDDebugSession() as unknown as vscode.DebugAdapter);
    },
  };

  const provider: vscode.DebugConfigurationProvider = {
    resolveDebugConfiguration(folder, config) {
      // Sessions start from 12d (the companion macro), never from F5 or launch.json.
      if (!config.replyFile) {
        if (config.type === '12dpl') {
          vscode.window.showInformationMessage(
            '12dPL debugging starts from 12d: run the Compile/Debug a Macro panel (companions/compile_debug_macro_panel.4dm).');
        }
        return undefined;
      }
      if (active12dSession()) {
        return vscode.window.showErrorMessage('A 12dPL debug session is already running. Stop it first.').then(() => undefined);
      }
      const settings = vscode.workspace.getConfiguration('12dpl', folder);
      for (const key of SETTINGS) {
        const value = settings.get(key);
        if (config[key] === undefined && value !== undefined && value !== null && value !== '') config[key] = value;
      }
      if (!config.outDir && folder) config.outDir = path.join(folder.uri.fsPath, '.12dpl-debug');
      return config;
    },
  };

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('12dpl', factory),
    vscode.debug.registerDebugConfigurationProvider('12dpl', provider),
    vscode.window.registerUriHandler({ handleUri }),
    vscode.debug.onDidStartDebugSession((s) => { if (s.type === '12dpl') sessions.add(s); }),
    vscode.debug.onDidTerminateDebugSession((s) => sessions.delete(s)),
    vscode.commands.registerCommand('12dpl.openSettings', () =>
      vscode.commands.executeCommand('workbench.action.openSettings', '@ext:georgegunter.12dpl-debugger')),
  );
}

export function deactivate() {}

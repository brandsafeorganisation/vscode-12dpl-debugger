import * as vscode from 'vscode';
import * as path from 'path';
import { TwelveDDebugSession } from './adapter/session';

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

  // F5 without a launch.json: debug the active .4dm file.
  const provider: vscode.DebugConfigurationProvider = {
    resolveDebugConfiguration(folder, config) {
      if (!config.type && !config.request && !config.name) {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === '12dpl') {
          config.type = '12dpl';
          config.name = 'Debug 12dPL macro';
          config.request = 'launch';
          config.program = '${file}';
          config.stopOnEntry = true;
        }
      }
      if (!config.program) {
        return vscode.window.showErrorMessage('Set "program" to the .4dm file containing main.').then(() => undefined);
      }
      if (!config.outDir && folder) config.outDir = path.join(folder.uri.fsPath, '.12dpl-debug');
      return config;
    },
  };

  context.subscriptions.push(
    vscode.debug.registerDebugAdapterDescriptorFactory('12dpl', factory),
    vscode.debug.registerDebugConfigurationProvider('12dpl', provider),
  );
}

export function deactivate() {}

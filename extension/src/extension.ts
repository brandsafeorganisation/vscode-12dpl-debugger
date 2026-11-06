import * as path from 'path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Run the adapter as a separate process using VS Code's own Node runtime.
  const factory: vscode.DebugAdapterDescriptorFactory = {
    createDebugAdapterDescriptor(): vscode.DebugAdapterDescriptor {
      const adapter = context.asAbsolutePath(path.join('out', 'adapter', 'main.js'));
      return new vscode.DebugAdapterExecutable(process.execPath, [adapter], {
        env: { ELECTRON_RUN_AS_NODE: '1' },
      });
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

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { compilerCpath } from './compilerEnv';

export const COMPANION_FILE = 'compile_debug_macro_panel.4dm';
export const DEFAULT_COMPILER = 'C:\\Program Files\\12d\\12dmodel\\15.00\\nt.x64\\cc4d.exe';
const LAST_FOLDER = 'companionFolder';

let output: vscode.OutputChannel | undefined;

/**
 * 12dPL: Build Companion Macro
 *
 * Copies the companion macro shipped with the extension into a folder the
 * user picks, compiles it there with cc4d.exe (12dpl.compilerPath, started
 * directly with no shell, with CPATH set as 12d would) and shows the .4do in
 * Explorer.
 */
export async function buildCompanion(context: vscode.ExtensionContext) {
  const source = path.join(context.extensionPath, 'companion', COMPANION_FILE);
  if (!fs.existsSync(source)) {
    vscode.window.showErrorMessage(`12dPL: the companion macro is missing from the extension (${source}).`);
    return;
  }

  const settings = vscode.workspace.getConfiguration('12dpl');
  const compiler = settings.get<string>('compilerPath') || DEFAULT_COMPILER;
  if (!fs.existsSync(compiler)) {
    const choice = await vscode.window.showErrorMessage(
      `12dPL: 12d's compiler was not found at ${compiler}.`, 'Set Compiler Path');
    if (choice) vscode.commands.executeCommand('workbench.action.openSettings', '12dpl.compilerPath');
    return;
  }

  const last = context.globalState.get<string>(LAST_FOLDER);
  const picked = await vscode.window.showOpenDialog({
    title: 'Folder to build the companion macro in',
    openLabel: 'Build Here',
    canSelectFolders: true,
    canSelectFiles: false,
    defaultUri: last && fs.existsSync(last) ? vscode.Uri.file(last) : undefined,
  });
  if (!picked || picked.length === 0) return;
  const folder = picked[0].fsPath;
  await context.globalState.update(LAST_FOLDER, folder);

  const target = path.join(folder, COMPANION_FILE);
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') !== fs.readFileSync(source, 'utf8')) {
    const replace = await vscode.window.showWarningMessage(
      `${COMPANION_FILE} in this folder is different from the extension's. Replace it?`, { modal: true }, 'Replace');
    if (!replace) return;
  }
  fs.copyFileSync(source, target);

  const compiled = target.replace(/\.4dm$/i, '.4do');
  const started = Date.now();
  output ??= vscode.window.createOutputChannel('12dPL Companion');
  output.clear();
  const cpath = compilerCpath(compiler, settings.get<string>('compilerCpath'), process.env);
  output.appendLine(`CPATH=${cpath}`);
  output.appendLine(`"${compiler}" ${COMPANION_FILE}   (in ${folder})`);

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Compiling the companion macro…' },
    () => new Promise<{ error: Error | null; stdout: string; stderr: string }>((resolve) =>
      execFile(compiler, [COMPANION_FILE], { cwd: folder, windowsHide: true, timeout: 120000, env: { ...process.env, CPATH: cpath } },
        (error, stdout, stderr) => resolve({ error, stdout: String(stdout), stderr: String(stderr) }))));
  if (result.stdout) output.append(result.stdout);
  if (result.stderr) output.append(result.stderr);

  const built = fs.existsSync(compiled) && fs.statSync(compiled).mtimeMs >= started - 2000;
  if (!built) {
    output.appendLine(result.error ? `\n${result.error.message}` : `\nNo ${path.basename(compiled)} was produced.`);
    output.show(true);
    vscode.window.showErrorMessage('12dPL: compiling the companion macro failed; see the 12dPL Companion output.');
    return;
  }
  output.appendLine(`\nBuilt ${compiled}`);
  await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(compiled));
  vscode.window.showInformationMessage(`12dPL: built ${path.basename(compiled)}. Run it from 12d to start debugging.`);
}

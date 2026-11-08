// Copies the companion macro source into the extension, so it ships in the .vsix.
// Runs as part of the build (and vsce's vscode:prepublish).
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', '..', 'companions', 'compile_debug_macro_panel.4dm');
const target = path.join(__dirname, '..', 'companion', 'compile_debug_macro_panel.4dm');
if (!fs.existsSync(source)) {
  if (fs.existsSync(target)) process.exit(0); // building from a copy of extension/ alone
  console.error(`Companion macro not found: ${source}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);

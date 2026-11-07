// Running compileCommand without a shell, so it works where PowerShell
// scripts (and possibly cmd.exe) are blocked.

/**
 * Split a command line into program and arguments. Whitespace separates
 * arguments and double quotes group them ("C:/Program Files/x.exe" "a b").
 * Backslashes are kept as they are, so Windows paths need no escaping.
 */
export function splitCommand(command: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  let any = false;
  for (const c of command) {
    if (c === '"') { quoted = !quoted; any = true; continue; }
    if (!quoted && /\s/.test(c)) {
      if (cur || any) out.push(cur);
      cur = '';
      any = false;
      continue;
    }
    cur += c;
  }
  if (cur || any) out.push(cur);
  return out;
}

/** compileCommand as [program, ...args], with ${file} and ${outDir} filled in. */
export function compileArgv(command: string | string[], file: string, outDir: string): string[] {
  const parts = Array.isArray(command) ? command : splitCommand(command);
  return parts.map((p) => p.replace(/\$\{file\}/g, file).replace(/\$\{outDir\}/g, outDir));
}

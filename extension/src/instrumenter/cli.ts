// Instrument a macro without VS Code, to inspect the output:
//   node out/instrumenter/cli.js <entry.4dm> <outDir> [sessionDir]
import * as path from 'path';
import * as fs from 'fs';
import { INSPECTORS_FILE_NAME, instrumentProgram, RUNTIME_FILE_NAME } from './instrument';
import { generateInspectors, resolveInspectors } from './inspectors';
import { generateRuntime } from './runtime';

const [entry, outDir, sessionDir] = process.argv.slice(2);
if (!entry || !outDir) {
  console.error('usage: cli.js <entry.4dm> <outDir> [sessionDir]');
  process.exit(2);
}
const inspectors = resolveInspectors();
const result = instrumentProgram(entry, outDir, { inspectors });
fs.writeFileSync(path.join(outDir, RUNTIME_FILE_NAME), generateRuntime({ sessionDir: sessionDir ?? path.resolve(outDir, 'session'), inspectors }));
fs.writeFileSync(path.join(outDir, INSPECTORS_FILE_NAME), generateInspectors(inspectors));
for (const f of result.files) console.log(`[${f.id}] ${f.source} -> ${f.output}  (breakpoint lines: ${f.breakpointLines.join(', ')})`);
for (const w of result.warnings) console.warn('warning: ' + w);

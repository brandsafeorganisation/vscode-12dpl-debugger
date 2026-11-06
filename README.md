# 12dpl-debugger

Step-through debugging of 12d Model macros (12dPL) from VS Code: breakpoints,
step over / in / out, pause, call stack, and variable values.

> **Status:** the VS Code side (extension, debug adapter, instrumenter) is
> covered by tests. The 12dPL runtime that runs inside 12d
> (`extension/src/instrumenter/runtime.ts`) is written against the function
> docs in `resources/` but has **not yet been compiled or run in 12d Model**.
> Expect to fix a few things there on the first real run.

## How it works

12dPL has no debugger hooks, so the macro is rewritten to report on itself.

```
 VS Code ──DAP (stdin/stdout)──▶ debug adapter ──files──▶ instrumented macro in 12d
   UI                             extension/out/adapter     (dbg12d_runtime.4dm)
```

1. **Launch.** VS Code starts the debug adapter (a separate Node process). The
   adapter copies the macro, plus every `#include "..."` it can resolve, into
   `outDir`, and adds code to each copy:
   - before each statement: `if (dbg12d_hit(file, line)) { <dump variables> dbg12d_wait(); }`
   - at function entry and on `return`: call-stack tracking
   - at the top of the entry file: `#include "dbg12d_runtime.4dm"`

   All added code goes on the same line as the original code, so line numbers
   stay the same. The one exception is the entry file, which gains one line at
   the top; keep that in mind when reading compiler errors for it.
2. **You compile and run** `outDir/<entry>.4dm` in 12d Model. You can also set
   `compileCommand` to have the adapter run the compiler for you.
3. **The channel is plain files** in `outDir/session/`:
   - The macro writes `m2a_<n>.txt`, then `m2a_<n>.ready`.
   - The adapter writes `a2m_<n>.txt`, then `a2m_<n>.ready`.
   - Each side deletes the messages it has read (the macro uses `File_delete`).

   When the macro hits a stop, it writes the call stack and variable values,
   then polls (`Sleep` + `File_exists`) until the adapter sends `continue`,
   `next`, `stepIn`, `stepOut` or `terminate`.

The full protocol is documented at the top of `extension/src/instrumenter/runtime.ts`.

## Using it

```bash
cd extension
npm install
npm run build
```

1. Open this repo in VS Code and run **Run 12dPL Debugger extension** (F5).
   This opens a second VS Code window with the extension loaded.
2. In that window, open your macro folder and the `.4dm` file containing `main`.
3. Set breakpoints and press F5. With no `launch.json`, it debugs the active file.
4. The Debug Console prints the path of the instrumented entry file. Compile
   and run that file in 12d.
5. 12d pauses on the first line of `main` (`stopOnEntry`). From there you can
   step, continue, look at variables, or hover over a name to see its value.

`launch.json` example:

```json
{
  "type": "12dpl",
  "request": "launch",
  "name": "Debug macro",
  "program": "${workspaceFolder}/my_macro.4dm",
  "outDir": "${workspaceFolder}/.12dpl-debug",
  "stopOnEntry": true,
  "compileCommand": "\"C:/Program Files/12d/12dmodel/15.00/nt.x64/cc4d.exe\" \"${file}\""
}
```

The `compileCommand` path above is only an example; point it at the 12d macro compiler in your own install, or leave it out and compile in 12d.

`outDir` is deleted and recreated on every launch. The adapter refuses to
launch if `outDir` contains the program.

If the instrumented macro is run without the debugger listening, it gives up
after 5 seconds, prints a note and runs normally.

To look at the instrumented output without VS Code:

```bash
npm run instrument -- path/to/macro.4dm path/to/outDir
```

## Limitations

- Breakpoints can only go on lines where a statement can start. A statement is
  not instrumented when it is the brace-less body of `if`/`else`/`for`/`while`,
  so `if (x)\n  y = 1;` cannot stop on the `y = 1;` line. A breakpoint there
  moves to the next line that can stop.
- Only one stop per line. Stepping is line by line.
- Values are sent for `Integer`, `Integer64`, `Real`, `Text`, `Uid`, `Guid`,
  `Element` (its name) and `Model` (its name). Other types and arrays are
  listed with their type only.
- Variables are only shown for the innermost stack frame.
- Variables declared inside `#if`/`#ifdef` blocks are not dumped, because they
  might not exist in the build.
- Pause takes effect at the next instrumented statement, and the macro checks
  for it every 500 statements. A macro blocked in `Wait_on_events` pauses once
  an event arrives.
- Each statement now costs a function call, so instrumented macros run slower.

## Layout

| Path | What |
| --- | --- |
| `extension/src/extension.ts` | VS Code extension: registers the `12dpl` debugger and starts the adapter |
| `extension/src/adapter/` | Debug adapter (DAP session plus the file channel) |
| `extension/src/instrumenter/` | Tokenizer, `.4dm` rewriter, generator for the 12dPL runtime |
| `extension/src/test/` | Instrumenter tests, and an end-to-end adapter test that uses a fake macro in place of 12d |
| `resources/` | 12dPL reference docs and sample macros |

```bash
cd extension
npm test
```

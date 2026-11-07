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
 VS Code ──DAP──▶ debug adapter ──files──▶ instrumented macro in 12d
   UI               (in the extension)       (dbg12d_runtime.4dm)
```

1. **Launch.** The companion macro asks VS Code to start a session (see
   below). The debug adapter runs inside the extension itself. It copies the macro, plus every `#include "..."` it can resolve, into
   `.12dpl-debug` (in the workspace folder, or next to the macro), and adds code to each copy:
   - before each statement: `if (dbg12d_hit(file, line)) { <dump variables> dbg12d_wait(); }`
   - at function entry and on `return`: call-stack tracking (`dbg12d_leave(); return x;`,
     so a function's last statement is still its `return`)
   - at the top of the entry file: `#include ".../dbg12d_runtime.4dm"`
   - at the bottom of the entry file: `#include ".../dbg12d_inspectors.4dm"`
     (see [Inspectors](#inspectors))

   All added code goes on the same line as the original code, so line numbers
   stay the same. The one exception is the entry file, which gains one line at
   the top; keep that in mind when reading compiler errors for it.

   Every `#include "..."` that resolves is rewritten to the absolute path of
   the instrumented copy. 12d's Compile option resolves relative includes
   against the project folder, so absolute paths are what make the copy
   compile the same from inside 12d and from outside it. Both branches of an
   `#ifdef __COMPILING_OUTSIDE_12D ... #else ... #endif` are rewritten, so
   whichever one is compiled includes the instrumented files. Includes are
   looked for next to the including file, then next to the entry file, then
   in `12dpl.includePaths`, then in 12d's `CPATH` folders (user_lib, user,
   library, set_ups). `#include <...>` lines are left for the 12d compiler
   to find. One that is not found is left as it was, with a warning
   in the Debug Console.
2. **The companion macro compiles and runs** the instrumented entry file
   with 12d's Compile/Run a Macro.
3. **The channel is plain files** in `.12dpl-debug/session/`:
   - The macro writes `m2a_<n>.txt`, then `m2a_<n>.ready`.
   - The adapter writes `a2m_<n>.txt`, then `a2m_<n>.ready`.
   - Each side deletes the messages it has read (the macro uses `File_delete`).

   When the macro hits a stop, it writes the call stack and variable values,
   then polls (`Sleep` + `File_exists`) until the adapter sends `continue`,
   `next`, `stepIn`, `stepOut` or `terminate`.

The full protocol is documented at the top of `extension/src/instrumenter/runtime.ts`.

## Locked-down (corporate) machines

The installed extension needs nothing but VS Code:

- No Node, npm or PowerShell. The debug adapter runs inside VS Code's
  extension host, so it doesn't start a process at all.
- `compileCommand`, if you set it, is started directly as an `.exe`, without
  PowerShell or cmd.
- The 12d side is plain 12dPL, which talks to VS Code through files in
  `.12dpl-debug/session/`.

So on a work machine, install the `.vsix` from the
[Releases page](https://github.com/boytoucher123/12dpl-debugger/releases).
VS Code's own policies still apply. If your organisation limits which
extensions can be installed, the `.vsix` has to be allowed like any other.

Only building the extension from source needs Node.

## Building from source

The repo's `.vscode/tasks.json` tasks are "process" tasks that start `node` or
`npm.cmd` directly, so they work when PowerShell blocks `npm.ps1`
("running scripts is disabled on this system"):

1. **Terminal → Run Task… → install extension dependencies** (once).
2. **Run 12dPL Debugger extension** (F5) builds the extension and opens a
   second VS Code window with it loaded.

From a terminal, use `npm.cmd`, not `npm`, in PowerShell, or use Command
Prompt:

```bash
cd extension
npm.cmd install
npm.cmd run build
```

## Using it: the companion macro

Debugging always starts from 12d. There is no F5 or `launch.json` in VS
Code; the 12d macro starts the debugger, not the other way round.

Install the `.vsix`, then compile `companions/compile_debug_macro_panel.4dm`
in 12d once. Set your breakpoints in VS Code whenever you like, before or
during the run.

1. Pick the macro source and the usual Compile/Run settings, then press
   **Compile/Debug**.
2. The panel writes the source path to `%TEMP%\12dpl_debug_request.txt`. It
   It also writes 12d's include search (`CPATH`, `SET_UPS_4D`, `USER_4D`,
   `LIB_4D` and `USER_LIB_4D`, read with `Getenv`). It then opens
   `vscode://12dpl-debugger.12dpl-debugger/debug?request=<that file>`
   with `Shell_execute`, which starts VS Code if needed. No script or shell is
   involved.
3. The extension opens the macro, starts a debug session, instruments it, and
   writes `ok`, the instrumented file and the session folder to
   `<request>.reply`.
4. The panel runs 12d's **Compile/Run a Macro** on the instrumented file with
   the panel's settings.
5. 12d pauses on the first line of `main` (the `12dpl.stopOnEntry` setting).
   From there you can step, continue, look at variables, or hover over a name
   to see its value.

If a debug session is already running, the extension answers with an error,
which the panel shows. The panel also refuses to start again while its last
debug build is still running.

Ready-built `.vsix` files are attached to each [GitHub Release](https://github.com/boytoucher123/12dpl-debugger/releases).

Releases are automatic. Whenever `main` changes, the **Release** workflow (`.github/workflows/release.yml`) checks the `"version"` in `extension/package.json`. If there is no release for that version yet, it runs the tests, packages the extension and publishes release `v<version>` with `12dpl-debugger-v<version>.vsix` attached. If that version is already released, it does nothing.

So to publish a new release, bump `"version"` (for example to `0.2.0`) and merge. You can also start it from **Actions → Release → Run workflow**, or push a `v<version>` tag yourself.

To build a `.vsix` yourself instead, run this in `extension/`:

```bash
npx @vscode/vsce package --skip-license
```

Then in VS Code: Extensions view → **⋯** → **Install from VSIX…**. The target machine doesn't need Node.

To look at the instrumented output without VS Code:

```bash
npm run instrument -- path/to/macro.4dm path/to/outDir
```

### Settings

Options live in the Settings editor: **File → Preferences → Settings**, search
for `12dpl`. The **12dPL: Open Debugger Settings** command also opens it.

| Setting | What it does |
| --- | --- |
| `12dpl.stopOnEntry` | Pause on the first line of `main`. |
| `12dpl.inspectors`, `12dpl.inspectDepth` | See [Inspectors](#inspectors). |
| `12dpl.includePaths` | Extra folders to search for quoted `#include`s. 12d's own `CPATH` folders are searched too, after these. |
| `12dpl.compileCommand` | An `.exe` to run after instrumenting, started directly with no shell. `${file}` is the instrumented entry file and `${outDir}` its folder. Quote parts with spaces, or give a list. |
| `12dpl.trace` | Log every message to and from the macro in the Debug Console. |

The instrumented copy goes in `.12dpl-debug` in the workspace folder that
holds the macro, or next to the macro if no folder is open. It is deleted
and recreated on every launch.

If the instrumented macro is run without the debugger listening, it gives up
after 5 seconds, prints a note and runs normally.

### One run at a time

Only one copy of a debug build runs at a time. While one is running (it holds
`.12dpl-debug/session/macro.lock`), starting it again prints a message and
exits. VS Code refuses a second 12dPL debug session, and the companion panel
won't start again while its last debug build is running.

### Stopping

The red Stop button in VS Code stops the macro:

- Paused at a breakpoint or step: it quits at once.
- Running: it quits within 50 statements.
- Waiting in `Wait_on_events` (a panel waiting for input): 12dPL has no way to
  interrupt that call or wake it from outside. The macro quits as soon as the
  call returns, that is, at the next panel event (a click or keystroke on its
  panel). The instrumented copy calls `Wait_on_events` / `Wait_on_widgets`
  through a wrapper that checks for Stop straight after each event.
- A debug build started after its session has ended quits immediately.

## Inspectors

Most 12d types (`Element`, `Model`, `Attributes`, `Dynamic_Integer`, ...) have
no text form, so the debugger can only show them through functions that read
them. An inspector is one such function, given as its 12dPL signature in
the `12dpl.inspectors` setting (in `settings.json` form):

```json
"12dpl.inspectors": [
  "Integer Get_name(Element elt, Text &name)",
  "Integer Get_colour(Element elt, Integer &colour)",
  "Integer Get_model(Element elt, Model &model)",
  "Integer Get_attribute(Element elt, \"width\", Real &width)",
  "Integer Get_number_of_items(Dynamic_Integer list, Integer &count)"
]
```

- The first parameter is the value being inspected; its type is the type the
  inspector is for.
- Each `&` parameter becomes a member, named after the parameter. A variable
  `l_kerb` of type `Element` then shows as
  `Element {name: "kerb", colour: 3, model: Model {name: "design"}, width: 0.15}`
  and expands into those members in the Variables view. Hovering or watching
  `l_kerb.model.name` works too.
- Other parameters must be literals (numbers, strings, or a `#define` name)
  and are passed as written.
- With no `&` parameters, the return value is the member, named after the
  function: `"Integer Get_number_of_items(Dynamic_Integer list)"`.
- If an inspector returns `Integer` and the result is not 0, the member shows
  `<Get_x returned N>` in place of a value.
- A member whose type has inspectors is expanded too, down to `inspectDepth`
  levels (default 3).
- Your own functions work as inspectors, which suits Attributes-based
  mock-structs: write `Integer debug_point_x(Attributes &p_point, Real &x)` in
  your macro and list its signature. Inspectors are compiled at the end of the
  program, so they can call anything your macro defines.
- Inspectors for a type replace the built-in ones for that type. The built-ins
  are: `Element`: `Get_name`, `Get_type`, `Get_points`, `Get_model`;
  `Model`: `Get_name`, `Get_number_of_items`.

More built-ins show what is typed into a panel field, through
`Get_data(<box>, Text &value)`. They cover `Input_Box`, `Real_Box`,
`Integer_Box`, `Model_Box`, `File_Box`, `Tick_Box`, `Named_Tick_Box` and
`Message_Box`.

Inspectors only run while the macro is stopped, for variables in the
innermost frame, so they cost nothing while the macro runs. List as many as
you like. Code is only generated for the inspected types the macro actually
uses (and their members' types), so an inspector that doesn't compile only
affects macros that use its type.

## Limitations

- Breakpoints can only go on lines where a statement can start. A statement is
  not instrumented when it is the brace-less body of `if`/`else`/`for`/`while`,
  so `if (x)\n  y = 1;` cannot stop on the `y = 1;` line. A breakpoint there
  moves to the next line that can stop.
- Only one stop per line. Stepping is line by line.
- Values are sent for `Integer`, `Integer64`, `Real`, `Text`, `Uid`, `Guid`,
  and any type with [inspectors](#inspectors). Other types and arrays are
  listed with their type only.
- The body of a `switch` itself has no breakpoint lines: 12d only allows
  `case`/`default` labels with braced blocks there. The statements inside those
  blocks can stop as usual; `case 1 : {` and a trailing `} break;` cannot.
- Variables are only shown for the innermost stack frame.
- The preprocessor is not run. Directive lines (including `\` continuations)
  are skipped, quoted `#include`s are followed in every branch, and variables
  declared inside `#if`/`#ifdef` blocks are not dumped, because they might not
  exist in the build. But `#if` conditions are not evaluated, so both
  branches of a conditional get instrumented, and macros are not expanded.
  Instrumentation breaks when braces only balance after preprocessing, for
  example `#ifdef A` / `if (x) {` / `#else` / `if (y) {` / `#endif`, or a
  `#define` that expands to `{` or `}`. A variable declared through a
  `#define`d type name isn't shown. A macro call used as a statement, like
  `DVAR1(l_x);`, is fine. If you leave off the `;` (`DVAR1(l_x)`), the
  statement after it can't take a breakpoint.
- Pause takes effect at the next instrumented statement, and the macro checks
  for it every 50 statements. A macro blocked in `Wait_on_events` pauses once
  an event arrives.
- Each statement now costs a function call, so instrumented macros run slower.

## Layout

| Path | What |
| --- | --- |
| `extension/src/extension.ts` | VS Code extension: registers the `12dpl` debugger and starts the adapter |
| `extension/src/adapter/` | Debug adapter (DAP session plus the file channel) |
| `extension/src/instrumenter/` | Tokenizer, `.4dm` rewriter, generator for the 12dPL runtime |
| `extension/.vscodeignore` | Files left out of the packaged `.vsix` |
| `extension/src/test/` | Instrumenter tests, and an end-to-end adapter test that uses a fake macro in place of 12d |
| `resources/` | 12dPL reference docs and sample macros |

```bash
cd extension
npm test
```

# Draw UI panel preview

Runs `companions/draw_panel/compile_debug_draw_panel.4dm` on Linux without 12d.
It plays scripted clicks and keys through the panel and saves what it draws as
PNG files. It is only for testing: nothing here goes into 12d. It is adapted
from the test harness in `12dpl-minecraft-macro` (`tools/test_harness`).

You need `g++`, `cpp`, `python3` and Pillow.

```bash
./run.sh
```

```bash
./run.sh scenarios/04_browse_dark.txt
```

## How it works

1. `translate.py` runs the C preprocessor over the macro with
   `DRAW_PANEL_PREVIEW` defined, removes the braces round global variables,
   adds 1 to array sizes and renames `main`. It also lints the `dui_*` /
   `ddp_*` code for ternaries, joined string literals, missing `p_` / `l_`
   prefixes, variables declared twice, and non-void functions that don't end
   in a `return`.
2. `DRAW_PANEL_PREVIEW` leaves out the original panel. Its `switch`es on Text
   and on `Get_id64()` aren't C++. `runtime.h` and `preview.cpp` provide what
   the original panel would have given instead. `request_debug_build()` fails
   ("VS Code did not answer") unless the scenario says `# vscode: ok`.
3. `runtime.h` has the 12dPL types and stand-ins for the calls. `Attributes`
   copies by value and reports fields read or written as the wrong type
   (`type errors` should stay 0). The program is built with AddressSanitizer
   and UndefinedBehaviorSanitizer.
4. `preview.cpp` keeps each frame's draw calls in order. `topng.py` replays them
   into `out/<name>.png`, with Liberation Sans at 104% in place of Segoe UI
   (as wide as Segoe UI in 12d) and Inter for Inter. The panel's size and
   position (`Get_widget_size`, `Get_widget_position`) are made up: a 7
   pixel margin round the drawing, and the Keys row unless it is collapsed.

## Scenarios

`scenarios/*.txt` has one command per line; `#` starts a comment. Three header
comments are read: `# args: -dark` is the macro's command line,
`# vscode: ok` makes VS Code "answer", and `# 12d theme: Dark` is what
`Get_active_theme_name` gives (for `-auto`). Coordinates are from the top left of
the box, as in a screenshot.

| Command | What it does |
| --- | --- |
| `move x y`, `down x y`, `click x y`, `dclick x y`, `leave` | mouse events on the Draw_Box (`click` is down and up) |
| `type <text>` | a keystroke for each character |
| `key <c>` | one key; `bs`, `ctrlbs`, `esc`, `tab`, `enter`, `paste`, `copy`, `space` |
| `clip <text>` | put text on the clipboard |
| `resize w h` | resize the box (`Panel_Resize`) |
| `about` | the panel's About event |
| `snap <name>` | save the box as it is now |
| `quit` | close the panel (also happens when the script runs out) |

Each run gets `run/macros` (some `.4dm` files, sub folders and a folder of 25
macros) for the file browser.

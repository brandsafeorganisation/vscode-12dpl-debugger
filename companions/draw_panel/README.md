# Compile/Debug a Macro, drawn in a Draw_Box (experiment)

A proof of concept: the companion panel (`../compile_debug_macro_panel.4dm`)
rebuilt with its widgets drawn in one `Draw_Box`, so it can have a light and a
dark theme. It does the same work: the original file is included unchanged and
its `request_debug_build()`, `panel_prompt_compile_run_a_macro()` and
`about_panel()` are called as they are. The extension still ships and builds
the original panel; this one is built by hand.

| Light (default) | Dark (`-dark`) |
| --- | --- |
| ![light](screenshots/light.png) | ![dark](screenshots/dark.png) |
| ![help](screenshots/help.png) | ![file browser](screenshots/dark_browse_macros.png) |
| ![Inter font](screenshots/modern.png) (`-modern`) | ![file list dragged](screenshots/drag_pinned_used.png) (dragged, so it stays open) |

The screenshots come from the Linux preview in `tools/draw_panel_preview`, not from
12d. It draws Segoe UI's text with Liberation Sans at 104%, which came out as
wide as Segoe UI in screenshots of 12d.

## Building and running

Compile `compile_debug_draw_panel.4dm` with `cc4d.exe` from this folder (as
**12dPL: Build Companion Macro** does for the original). It includes files by
relative path, which works when `cc4d.exe` is run directly. 12d's own Compile
option looks for includes in the project folder, so it won't find them.

Options come from the macro's command line (Macro Arguments in 12d's
Run/Compile panels). A `-`, `--` or `/` in front is optional, and case doesn't
matter. Anything else is ignored.

| Argument | What it does |
| --- | --- |
| none, `-light`, `--theme=light` | light theme |
| `-dark`, `--theme=dark` | dark theme |
| `-auto`, `--theme=auto` | dark if 12d's theme name (`Get_active_theme_name`) has "dark" in it, else light |
| `-modern` | text in Inter instead of Segoe UI |
| `font=<name>` | text in any installed font, e.g. `font="Segoe UI Variable Text"` |
| `-fill` | no border gap and no gap in the drawing's vertical group (`Set_border(group, 0, 0)`, `Set_gap(group, 0)`) |
| `grow=<pixels>` | once the panel is shown, make the drawing that many pixels wider and taller (`Set_size`) |
| `-keys` | show the Keys box (it is collapsed and hidden otherwise) |

The last theme argument wins.

### Fonts

Segoe UI is the default, as in 12d's own panels; every Windows has it.
`-modern` uses [Inter](https://rsms.me/inter/), which isn't part of Windows:
install it first (download it, open `Inter.ttc` or the `.ttf` files and click
**Install**, then restart 12d). If a font isn't installed, Windows draws a
fallback font instead. On Windows 11, `font="Segoe UI Variable Text"` is a
newer looking font with nothing to install.

12d can't measure text, so each font has an estimate of a character's width
(`DUI_FONT_*_WIDTH`). The label and buttons are sized from it. A font given
with `font=` gets a wide estimate, so text may stop a little early.

### The margin round the drawing

12d leaves a margin round the Draw_Box in the panel's own colour (white in
the screenshots). It is there without the vertical group too, so it seems
to belong to the panel. `-fill` takes out the group's border and gap, which
is all the documented calls can do. `grow=<pixels>` tries `Set_size` on the
Draw_Box after the panel is shown. That may only make the panel bigger,
and it can only cover the right and bottom margins, because there is no
call to move a widget. Help lists the sizes and positions 12d reports for
the panel and the drawing (`Get_widget_size`, `Get_widget_position`) and
12d's theme name, to see what the options change.

## Layout

```
compile_debug_draw_panel.4dm   base file: main() reads the theme and shows the panel
src/build.4dm                  includes the original panel (main renamed), then the files below
src/draw_ui.4dm                the kit: widget record, popup list, mouse and keys -> actions
src/draw_ui_render.4dm         the kit: drawing the widgets and the popup
src/draw_ui_theme.4dm          the kit: light and dark colours, command line
src/draw_ui_files.4dm          the kit: a file browser in the popup
src/debug_draw_panel.4dm       this panel: layout, and what its buttons do
include/*.h                    #defines and prototypes for each
```

Only `debug_draw_panel.4dm` knows about this panel. The `dui_*` files are a
small widget kit that any macro can use.

## The Draw UI kit

It follows the pattern from Cubeland's menus (`12dpl-minecraft-macro`,
`src/render/render_menu.4dm`). A screen is an `Attributes` record. Each frame
the widgets are laid out again and drawn. Values (a field's text, a tick) are
kept under the widget's id, so they survive from frame to frame:

```
// each frame
Start_batch_draw(box);
dui_begin(ui, w, h);
dui_add_down(ui, DUI_TICK, MY_TICK, x0, top, x1, bottom, "Label", TRUE);  // distances from the top
...
dui_draw(box, ui, theme);
End_batch_draw(box);

// each event
if (id == Get_id64(box))  act = dui_mouse(ui, cmd, msg, widget);
if (id == Get_id64(keys)) act = dui_keystroke(ui, msg, widget);
switch (act) {   // DUI_ACT_REDRAW / CLICK / TICK / PICK / ENTER, with the widget's id
  ...
}
```

| Kind | What it does |
| --- | --- |
| `DUI_GROUP` | A frame with its title on the top line, like a 12d group border. An empty title draws a plain frame. |
| `DUI_LABEL` | A line of text. |
| `DUI_TICK` | A tick box. A click ticks it (`DUI_ACT_TICK`). |
| `DUI_FIELD` | A one-line text box. A click gives it the keyboard. It takes typing, Backspace, Ctrl+Backspace, Ctrl+C/X/V (clipboard), Esc and Enter. |
| `DUI_BUTTON` | A push button (`DUI_ACT_CLICK`). An `&` in the label is dropped, as in 12d. |
| `DUI_BROWSE` | The folder button at the end of a file field. |
| `DUI_MESSAGE` | The message line. `dui_set_message(..., TRUE)` shows the text in red. |
| popup | One list over the widgets, like a choice box's list. It has a title bar, a close cross, row icons and a scroll bar (click the track to page, or drag it). A row with a value can be picked (`DUI_ACT_PICK`). A row with no value is plain text, which the help uses. Drag the title bar to move it: once moved it is pinned, and stays open while the widgets beside it are used. A popup that wasn't moved closes on a click outside it. |

`dui_files_open()` / `dui_files_pick()` fill the popup with a folder's sub folders and
matching files. A Draw_Box panel can't open 12d's own file dialog, so this
stands in for the File_Box's browse button.

Themes are records of colours by role (`DUI_C_TEXT`, `DUI_C_ACCENT`, ...),
plus the font, its size and its width estimate (`dui_theme_font()`).
To add a theme, add a case to `dui_theme_set()`. Text measuring functions
(`dui_text_width`, `dui_fit_text`) take the theme, so layouts can size
widgets to their text.

## What was learnt about the Draw_Box (from Cubeland)

- Draw only between `Start_batch_draw` and `End_batch_draw`, and redraw the
  whole box each time (`Clear` first).
- y goes up from the bottom left. Text is placed by its top (`Set_text_align`
  0 for top left, 6 for top centre, which are Windows' `TA_*` flags).
  `Set_bk_mode(box, 1)` draws text with no background box.
- A filled rectangle is a 4 point `Draw_polygon` with `Set_colour` and
  `Set_fill_colour` set to the same colour. Each call costs about as much as
  a polygon, so the kit doesn't set a colour that is already set.
- 12d can't measure text, so widths are estimates (`DUI_CHAR_WIDTH`). Long
  text is cut short with `...`. Fields and paths keep their end in view.
- A Draw_Box gets mouse events (`mouse_move`, `click_lb_down`, `click_lb`,
  `double_click_lb`, `mouse_leave`, with `"x y"` in the message) but no key
  presses. A small input box ("Keys") under the drawing keeps the keyboard.
  Its `keystroke` events are passed to the focused field, and it is emptied
  after each one. It is collapsed (`Set_collapsed`) before the panel is
  shown and hidden (`Set_visible`) after, so it takes no room.
- `Set_sizing_constraints(box, 2, 2)` and `Set_notify_resizing(panel)` let the
  drawing fill a resized panel (`Panel_Resize`).

## Not checked in 12d yet

This was written and run on Linux only, in the preview. Things to check in 12d:

- `#define main ...` before including the original file, so its `main` gets
  another name.
- Whether 12d sends Tab, Ctrl+C/X/V and Enter to the Keys box as `keystroke`
  events (Enter may come as `text selected`; both are handled), or uses them
  itself.
- `List_subfolders_in_folder` / `List_files_in_folder`: whether they return
  names or full paths (both are handled).
- Whether the Keys box still gets the typing while collapsed and hidden. If
  it doesn't, run with `-keys`.
- What `-fill` and `grow=<pixels>` do to the margin (see Help for the sizes).
- `Get_active_theme_name`'s names, for `-auto`.
- Text widths with Inter and with Segoe UI at the new text size (13).
- `request_debug_build()` writes its progress into a message box that isn't on
  the panel. The drawn line shows "Starting the debugger in VS Code..." before
  it is called, and its last message after it returns. The "Waiting for VS
  Code to start..." step in between isn't shown.

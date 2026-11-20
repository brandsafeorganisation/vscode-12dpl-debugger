// --------------------------------------------------------
// Macro: compile_debug_draw_panel.4do
// Date: 19/11/2026
// Programmer: George Gunter
//
// Brief description:
//  Compile/Debug a Macro, with its widgets drawn in a Draw_Box
//
// Description:
//  The same panel and the same work as compile_debug_macro_panel.4dm
//  (which this build includes unchanged), drawn with the Draw UI kit
//  in src/draw_ui*.4dm so it can be themed. An experiment: see
//  README.md in this folder.
//
//  Command line (any - or / in front is fine; the last theme wins):
//    -dark, -light, -auto   theme (light by default; auto follows 12d's)
//    -modern                the Inter font instead of Segoe UI
//    font=<name>            any installed font, e.g. font="Segoe UI Variable Text"
//    -fill                  no gaps round the drawing in its group
//    grow=<pixels>          make the drawing bigger once shown, to cover 12d's margin
//    -keys                  show the Keys box that takes the typing
// --------------------------------------------------------

#ifdef COMPILE_DEBUG_DRAW_PANEL_BASE_FILE_4DM_INCLUDED
#error Do not include the base file!
#endif
#define COMPILE_DEBUG_DRAW_PANEL_BASE_FILE_4DM_INCLUDED

#include "src/build.4dm"

void main()
// --------------------------------------------------------
// --------------------------------------------------------
{
  Attributes theme;
  Text       grow = "";
  Integer    grow_pixels = 0;
  Integer    ret = 0;

  dui_theme_set                (theme, dui_theme_from_arguments(DUI_THEME_LIGHT));
  dui_theme_font_from_arguments(theme);
  if (dui_argument_value(DDP_ARG_GROW, grow)) From_text(grow, grow_pixels);

  ret = show_draw_panel(theme, dui_has_argument(DDP_ARG_FILL), grow_pixels, dui_has_argument(DDP_ARG_KEYS));
  if (ret == Shutdown_code) {
    // Exit quickly
    return;
  }

  return;
}

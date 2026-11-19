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
//  Command line:
//    -dark    dark theme
//    -light   light theme (the default)
//  (also dark, /dark, --theme=dark ...; the last one given wins)
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
  Integer ret = show_draw_panel(dui_theme_from_arguments(DUI_THEME_LIGHT));
  if (ret == Shutdown_code) {
    // Exit quickly
    return;
  }

  return;
}

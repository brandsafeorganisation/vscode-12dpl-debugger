#ifndef INCLUDE_BUILD_4DM
#define INCLUDE_BUILD_4DM

// ----------------------------------------------------------------
// Build file for compile_debug_draw_panel.4dm
// ----------------------------------------------------------------

// The original panel brings the work behind the button
// (request_debug_build, panel_prompt_compile_run_a_macro, about_panel,
// Shutdown_code, SUCCESS / FAILURE, DEBUG_FINISHED_FILE). It is
// included as it is, with its main() renamed so it doesn't clash.
// The preview build (tools/draw_panel_preview) stands those in
// itself, as its translator can't read the original's switches.
#ifndef DRAW_PANEL_PREVIEW
#define main compile_debug_macro_panel_main
#include "../../compile_debug_macro_panel.4dm"
#undef main
#endif

#include "../include/draw_ui.h"
#include "../include/debug_draw_panel.h"

// Source files, any order
#include "draw_ui.4dm"
#include "draw_ui_theme.4dm"
#include "draw_ui_render.4dm"
#include "draw_ui_files.4dm"
#include "debug_draw_panel.4dm"

#else
#error Do not include build.4dm more than once
#endif

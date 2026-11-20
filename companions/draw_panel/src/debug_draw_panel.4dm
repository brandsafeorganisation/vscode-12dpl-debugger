#ifndef DEBUG_DRAW_PANEL_4DM_INCLUDED
#define DEBUG_DRAW_PANEL_4DM_INCLUDED

#include "../include/draw_ui.h"
#include "../include/debug_draw_panel.h"

// ----------------------------------------------------------------
// Compile/Debug a Macro, drawn in a Draw_Box.
//
// The same panel as companions/compile_debug_macro_panel.4dm, with
// the same options and the same work behind the button: it calls
// that file's request_debug_build(), panel_prompt_compile_run_a_macro()
// and about_panel(). Only the widgets are different: they are drawn
// with the Draw UI kit (draw_ui*.4dm), so they can be themed.
//
// The panel holds the Draw_Box and a small "Keys" input box, which
// keeps the keyboard (a Draw_Box gets no key presses): typing there
// goes to the field that was clicked. The Keys box is collapsed and
// hidden unless the command line has -keys.
// ----------------------------------------------------------------

void ddp_defaults(Attributes &p_ui)
// ----------------------------------------------------------------
// The panel's starting values
// ----------------------------------------------------------------
{
  dui_set_text   (p_ui, DDP_W_MACRO_SOURCE    , "");
  dui_set_text   (p_ui, DDP_W_MACRO_ARGUMENTS , "");
  dui_set_ticked (p_ui, DDP_W_ALLOW_OLD_STRING, DEFAULT_ALLOW_OLD_STRING);
  dui_set_ticked (p_ui, DDP_W_ALLOW_OLD_ID    , DEFAULT_ALLOW_OLD_ID);
  dui_set_ticked (p_ui, DDP_W_KEEP_CPP        , DEFAULT_KEEP_CPP);
  dui_set_ticked (p_ui, DDP_W_SHOW_BUTTONS    , DEFAULT_SHOW_BUTTONS);
  dui_set_ticked (p_ui, DDP_W_SHOW_CONSOLE    , DEFAULT_SHOW_CONSOLE);
  dui_set_ticked (p_ui, DDP_W_RETAIN_ON_EXIT  , DEFAULT_RETAIN_ON_EXIT);
  dui_set_ticked (p_ui, DDP_W_ALLOW_DEFAULTS  , DEFAULT_ALLOW_DEFAULTS);
  dui_set_ticked (p_ui, DDP_W_KEEP_PANEL_OPEN , DEFAULT_KEEP_PANEL_OPEN);
  dui_set_message(p_ui, DDP_W_MESSAGE         , "", FALSE);
}

void ddp_layout(Attributes &p_ui, Attributes &p_theme, Real p_w, Real p_h)
// ----------------------------------------------------------------
// Lay the panel out for a w x h box, top down, in the order of the
// original panel. A group is added after what is in it (it only
// draws a frame round it). The label and the buttons are as wide as
// the theme's font needs.
// ----------------------------------------------------------------
{
  Real l_left   = 6.0;              // group frames
  Real l_right  = p_w - 6.0;
  Real l_in0    = 16.0;             // what is inside a group
  Real l_in1    = p_w - 16.0;
  Real l_mid    = p_w / 2.0;
  Real l_t      = 4.0;              // how far down the next row starts
  Real l_group  = 0.0;
  Real l_button = 104.0;            // button width, at least
  Real l_gap    = 10.0;
  Real l_bx     = 0.0;
  Real l_label  = dui_text_width(p_theme, "Macro source") + 6.0;
  Real l_widest = dui_text_width(p_theme, "Compile/Debug") + 12.0;

  if (l_widest > l_button) l_button = l_widest;
  if (3.0 * l_button + 2.0 * l_gap > p_w - 12.0) l_button = (p_w - 12.0 - 2.0 * l_gap) / 3.0;

  dui_begin(p_ui, p_w, p_h);

  // ------------------------------------------------ Compile Options
  l_group = l_t;
  l_t = l_t + 20.0;
  dui_add_down(p_ui, DUI_LABEL , DDP_W_SOURCE_LABEL , l_in0          , l_t, l_in0 + l_label, l_t + 22.0, "Macro source", TRUE);
  dui_add_down(p_ui, DUI_FIELD , DDP_W_MACRO_SOURCE , l_in0 + l_label, l_t, l_in1 - 28.0   , l_t + 22.0, ""            , TRUE);
  dui_add_down(p_ui, DUI_BROWSE, DDP_W_BROWSE_SOURCE, l_in1 - 24.0 , l_t, l_in1       , l_t + 22.0, ""            , TRUE);
  l_t = l_t + 27.0;
  dui_add_down(p_ui, DUI_TICK, DDP_W_ALLOW_OLD_STRING, l_in0, l_t, l_in1, l_t + 22.0, "Allow old string calls", TRUE);
  l_t = l_t + 23.0;
  dui_add_down(p_ui, DUI_TICK, DDP_W_ALLOW_OLD_ID    , l_in0, l_t, l_in1, l_t + 22.0, "Allow old id calls"    , TRUE);
  l_t = l_t + 23.0;
  dui_add_down(p_ui, DUI_TICK, DDP_W_KEEP_CPP        , l_in0, l_t, l_in1, l_t + 22.0, "Keep cpp file"         , TRUE);
  l_t = l_t + 27.0;
  dui_add_down(p_ui, DUI_GROUP, DDP_W_COMPILE_GROUP, l_left, l_group, l_right, l_t, "Compile Options", TRUE);
  l_t = l_t + 6.0;

  // ------------------------------------------------ Macro Arguments
  l_group = l_t;
  l_t = l_t + 20.0;
  dui_add_down(p_ui, DUI_FIELD, DDP_W_MACRO_ARGUMENTS, l_in0, l_t, l_in1, l_t + 22.0, "", TRUE);
  l_t = l_t + 30.0;
  dui_add_down(p_ui, DUI_GROUP, DDP_W_ARGUMENTS_GROUP, l_left, l_group, l_right, l_t, "Macro Arguments", TRUE);
  l_t = l_t + 6.0;

  // ------------------------------------------------ Run Parameters (two columns)
  l_group = l_t;
  l_t = l_t + 20.0;
  dui_add_down(p_ui, DUI_TICK, DDP_W_SHOW_BUTTONS  , l_in0      , l_t, l_mid - 4.0, l_t + 22.0, "Show buttons"  , TRUE);
  dui_add_down(p_ui, DUI_TICK, DDP_W_RETAIN_ON_EXIT, l_mid + 4.0, l_t, l_in1      , l_t + 22.0, "Retain on exit", TRUE);
  l_t = l_t + 23.0;
  dui_add_down(p_ui, DUI_TICK, DDP_W_SHOW_CONSOLE  , l_in0      , l_t, l_mid - 4.0, l_t + 22.0, "Show console"  , TRUE);
  dui_add_down(p_ui, DUI_TICK, DDP_W_ALLOW_DEFAULTS, l_mid + 4.0, l_t, l_in1      , l_t + 22.0, "Allow defaults", TRUE);
  l_t = l_t + 27.0;
  dui_add_down(p_ui, DUI_GROUP, DDP_W_RUN_GROUP, l_left, l_group, l_right, l_t, "Run Parameters", TRUE);
  l_t = l_t + 6.0;

  // ------------------------------------------------ Keep panel open (the original's "-" border: a plain frame)
  l_group = l_t;
  l_t = l_t + 13.0;
  dui_add_down(p_ui, DUI_TICK, DDP_W_KEEP_PANEL_OPEN, l_in0, l_t, l_in1, l_t + 22.0, "Keep panel open after run", TRUE);
  l_t = l_t + 27.0;
  dui_add_down(p_ui, DUI_GROUP, DDP_W_KEEP_GROUP, l_left, l_group, l_right, l_t, "", TRUE);
  l_t = l_t + 8.0;

  // ------------------------------------------------ message line
  dui_add_down(p_ui, DUI_MESSAGE, DDP_W_MESSAGE, l_left, l_t, l_right, l_t + 22.0, "", TRUE);
  l_t = l_t + 30.0;

  // ------------------------------------------------ buttons, centred
  l_bx = (p_w - 3.0 * l_button - 2.0 * l_gap) / 2.0;
  dui_add_down(p_ui, DUI_BUTTON, DDP_W_COMPILE_DEBUG, l_bx, l_t, l_bx + l_button, l_t + 26.0, "&Compile/Debug", TRUE);
  l_bx = l_bx + l_button + l_gap;
  dui_add_down(p_ui, DUI_BUTTON, DDP_W_FINISH       , l_bx, l_t, l_bx + l_button, l_t + 26.0, "&Finish"       , TRUE);
  l_bx = l_bx + l_button + l_gap;
  dui_add_down(p_ui, DUI_BUTTON, DDP_W_HELP         , l_bx, l_t, l_bx + l_button, l_t + 26.0, "&Help"         , TRUE);
}

void ddp_frame(Draw_Box p_box, Attributes &p_ui, Attributes &p_theme)
// ----------------------------------------------------------------
// Lay the panel out for the box's size and draw it
// ----------------------------------------------------------------
{
  Integer l_width  = 0;
  Integer l_height = 0;

  Get_size(p_box, l_width, l_height);
  Start_batch_draw(p_box);
  ddp_layout(p_ui, p_theme, l_width, l_height);
  dui_draw  (p_box, p_ui, p_theme);
  End_batch_draw(p_box);
}

void ddp_help_open(Attributes &p_ui, Attributes &p_theme)
// ----------------------------------------------------------------
// Help, in the popup over the options
// ----------------------------------------------------------------
{
  Real l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;

  dui_widget_rect(p_ui, dui_widget_of(p_ui, DDP_W_COMPILE_GROUP), l_x0, l_y0, l_x1, l_y1);
  dui_popup_open(p_ui, DDP_W_HELP, "Help - Compile/Debug a Macro", l_x0, l_y1, l_x1);
  dui_popup_add (p_ui, "Compile/Debug asks VS Code (12dPL Debugger)" , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "to debug the macro, then runs Compile/Run"   , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "on the copy it makes, with these options."   , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, ""                                            , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "Macro source: the .4dm with main."           , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "The folder button browses for it."           , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "Drag its title bar and the list stays open." , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "Click a field to type; Tab, Esc, Ctrl+V."    , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, ""                                            , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "Command line: -dark, -light or -auto;"       , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "-modern (Inter) or font=<name>;"             , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "-fill, grow=<pixels>, -keys."                , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, ""                                            , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, "Font: " + dui_theme_font_name(p_theme)       , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, dui_get_text(p_ui, DDP_ATTR_SIZE_THEME)        , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, dui_get_text(p_ui, DDP_ATTR_SIZE_PANEL)        , "", DUI_ICON_NONE);
  dui_popup_add (p_ui, dui_get_text(p_ui, DDP_ATTR_SIZE_BOX)          , "", DUI_ICON_NONE);
}

void ddp_measure(Panel p_panel, Draw_Box p_box, Attributes &p_ui)
// ----------------------------------------------------------------
// Note where 12d put the panel and the drawing, and 12d's theme, for
// Help (to see how much of the panel the drawing covers)
// ----------------------------------------------------------------
{
  Integer l_w = 0, l_h = 0, l_x = 0, l_y = 0;
  Text    l_theme = "";

  Get_active_theme_name(l_theme);
  Set_attribute(p_ui, DDP_ATTR_SIZE_THEME, "12d theme: " + l_theme);

  Get_widget_size    (p_panel, l_w, l_h);
  Get_widget_position(p_panel, l_x, l_y);
  Set_attribute(p_ui, DDP_ATTR_SIZE_PANEL, "Panel " + To_text(l_w) + " x " + To_text(l_h) + " at " + To_text(l_x) + ", " + To_text(l_y));

  l_w = 0; l_h = 0; l_x = 0; l_y = 0;
  Get_widget_size    (p_box, l_w, l_h);
  Get_widget_position(p_box, l_x, l_y);
  Set_attribute(p_ui, DDP_ATTR_SIZE_BOX, "Drawing " + To_text(l_w) + " x " + To_text(l_h) + " at " + To_text(l_x) + ", " + To_text(l_y));
}

void ddp_browse_open(Attributes &p_ui)
// ----------------------------------------------------------------
// The file browser under the Macro source field
// ----------------------------------------------------------------
{
  Real l_lx0 = 0.0, l_ly0 = 0.0, l_lx1 = 0.0, l_ly1 = 0.0;
  Real l_bx0 = 0.0, l_by0 = 0.0, l_bx1 = 0.0, l_by1 = 0.0;

  // from the label to the folder button, just under them
  dui_widget_rect(p_ui, dui_widget_of(p_ui, DDP_W_SOURCE_LABEL) , l_lx0, l_ly0, l_lx1, l_ly1);
  dui_widget_rect(p_ui, dui_widget_of(p_ui, DDP_W_BROWSE_SOURCE), l_bx0, l_by0, l_bx1, l_by1);
  dui_files_open (p_ui, DDP_W_BROWSE_SOURCE, dui_text(p_ui, DDP_W_MACRO_SOURCE), DDP_SOURCE_PATTERN, l_lx0, l_by0 - 1.0, l_bx1);
}

Integer ddp_compile_debug(Panel p_panel, Draw_Box p_box, Message_Box p_message, Attributes &p_ui, Attributes &p_theme, Text &p_last_session_dir)
// ----------------------------------------------------------------
// The Compile/Debug button: what the original panel does, reading
// the options from the drawn widgets. request_debug_build() reports
// into p_message (not on the panel); its last word is copied to the
// drawn message line.
// ----------------------------------------------------------------
{
  Text    l_source      = dui_path_unquote(dui_text(p_ui, DDP_W_MACRO_SOURCE));
  Text    l_debug_4dm   = "";
  Text    l_session_dir = "";
  Text    l_reply       = "";
  Integer l_prompt      = 0;

  // One debug run at a time: the debugger can only follow one copy.
  if (p_last_session_dir != "") {
    if (File_exists(p_last_session_dir + "\\macro.lock") != 0) {
      dui_set_message(p_ui, DDP_W_MESSAGE, "The last debug build is still running. Finish it, or stop debugging in VS Code.", TRUE);
      return FAILURE;
    }
  }

  // Macro source
  if (l_source == "") {
    dui_set_message(p_ui, DDP_W_MESSAGE, "Macro source: pick the macro to debug", TRUE);
    dui_set_focus  (p_ui, DDP_W_MACRO_SOURCE);
    return FAILURE;
  }
  l_source = Get_absolute_path(l_source);
  if (File_exists(l_source) == 0) {
    dui_set_message(p_ui, DDP_W_MESSAGE, "Macro source: file must exist", TRUE);
    dui_set_focus  (p_ui, DDP_W_MACRO_SOURCE);
    return FAILURE;
  }
  dui_set_text (p_ui, DDP_W_MACRO_SOURCE, l_source);
  dui_set_focus(p_ui, 0);

  // Ask VS Code; show that we are waiting while it starts
  dui_set_message(p_ui, DDP_W_MESSAGE, "Starting the debugger in VS Code...", FALSE);
  ddp_frame(p_box, p_ui, p_theme);
  Set_data(p_message, "");
  if (request_debug_build(p_panel, p_message, l_source, l_debug_4dm, l_session_dir) != SUCCESS) {
    Get_data(p_message, l_reply);
    dui_set_message(p_ui, DDP_W_MESSAGE, l_reply, TRUE);
    return FAILURE;
  }
  p_last_session_dir = l_session_dir;
  dui_set_message(p_ui, DDP_W_MESSAGE, "Debugging " + l_debug_4dm, FALSE);
  ddp_frame(p_box, p_ui, p_theme);

  l_prompt = panel_prompt_compile_run_a_macro(
    l_debug_4dm,
    dui_ticked(p_ui, DDP_W_ALLOW_OLD_STRING), dui_ticked(p_ui, DDP_W_ALLOW_OLD_ID), dui_ticked(p_ui, DDP_W_KEEP_CPP),
    dui_text(p_ui, DDP_W_MACRO_ARGUMENTS),
    dui_ticked(p_ui, DDP_W_SHOW_BUTTONS), dui_ticked(p_ui, DDP_W_SHOW_CONSOLE), dui_ticked(p_ui, DDP_W_RETAIN_ON_EXIT),
    dui_ticked(p_ui, DDP_W_ALLOW_DEFAULTS), dui_ticked(p_ui, DDP_W_KEEP_PANEL_OPEN)
  );
  if (l_prompt != 0) {
    dui_set_message(p_ui, DDP_W_MESSAGE, "Compile/Run a Macro failed (" + To_text(l_prompt) + ")", TRUE);
  } else if (File_exists(p_last_session_dir + "\\" + DEBUG_FINISHED_FILE) != 0) {
    dui_set_message(p_ui, DDP_W_MESSAGE, "Debugging finished", FALSE);
    p_last_session_dir = "";
  }
  return SUCCESS;
}

Integer show_draw_panel(Attributes &p_theme, Integer p_fill, Integer p_grow, Integer p_show_keys)
// ----------------------------------------------------------------
// Show the panel in a theme (dui_theme_set) until Finish or the
// panel is closed. Returns Shutdown_code if 12d is shutting down,
// else 0.
//
// Trying to cover the panel with the drawing (12d leaves a margin
// round it in the panel's own colour):
//   p_fill       no border gap or gap in the drawing's vertical group
//   p_grow       pixels to make the drawing wider and taller once
//                the panel is shown (Set_size), 0 for none
//   p_show_keys  show the Keys box (else it is collapsed and hidden;
//                it still takes the keyboard)
// ----------------------------------------------------------------
{
  Panel          l_panel   = Create_panel         (DDP_TITLE, 1, 1, 1);
  Vertical_Group l_vgroup  = Create_vertical_group(0);
  Message_Box    l_message = Create_message_box   ("");   // not on the panel: request_debug_build() reports into it
  Draw_Box       l_box     = Create_draw_box      (DDP_VIEW_WIDTH, DDP_VIEW_HEIGHT, 0);
  Input_Box      l_keys    = Create_input_box     (DDP_KEYS_TITLE, l_message);

  Attributes   l_ui;
  Dynamic_Text l_about_text;

  Integer   l_box_w      = 0;
  Integer   l_box_h      = 0;

  Integer   l_doit       = TRUE;
  Integer   l_want_frame = TRUE;
  Integer   l_act        = DUI_ACT_NONE;
  Integer   l_widget     = 0;
  Integer64 l_id         = 0LL;
  Text      l_cmd        = "";
  Text      l_msg        = "";
  Text      l_path       = "";

  // Session folder of the last debug build started from here; while its
  // macro.lock exists that build is still running.
  Text l_last_session_dir = "";

  dui_clear    (l_ui);
  ddp_defaults (l_ui);

  // Panel layout
  Append(l_vgroup, l_panel);
  {
    Append(l_box , l_vgroup);
    Append(l_keys, l_vgroup);
  }
  Set_width_in_chars    (l_keys, 4);
  Use_browse_button     (l_keys, 0 /*FALSE*/);
  Set_sizing_constraints(l_box   , 2, 2);   // the drawing fills the panel when it is resized
  Set_sizing_constraints(l_vgroup, 2, 2);
  Set_notify_resizing   (l_panel);
  if (p_fill) {
    Set_border(l_vgroup, 0, 0);
    Set_gap   (l_vgroup, 0);
  }
  if (!p_show_keys) Set_collapsed(l_keys, 1);   // takes no room on the panel

  Show_widget(l_panel);
  if (!p_show_keys) Set_visible(l_keys, 0);     // in case collapsing didn't hide it
  if (p_grow > 0) {
    Get_widget_size(l_box, l_box_w, l_box_h);
    Set_size       (l_box, l_box_w + p_grow, l_box_h + p_grow);
  }
  ddp_measure(l_panel, l_box, l_ui);
  Set_focus  (l_keys);

  while (l_doit) {
    if (l_want_frame) {
      ddp_frame(l_box, l_ui, p_theme);
      l_want_frame = FALSE;
    }

    l_id  = 0LL;
    l_cmd = "";
    l_msg = "";
    Wait_on_events(l_id, l_cmd, l_msg);

    if (l_last_session_dir != "") {
      if (File_exists(l_last_session_dir + "\\" + DEBUG_FINISHED_FILE) != 0) {
        dui_set_message(l_ui, DDP_W_MESSAGE, "Debugging finished", FALSE);
        l_last_session_dir = "";
        l_want_frame       = TRUE;
      }
    }

    if (l_cmd == "CodeShutdown") {
      Set_exit_code("CodeShutdown");
      return Shutdown_code;
    }
    if (l_cmd == "Panel_Resize") l_want_frame = TRUE;

    // ------------------------------------------------ the panel
    if (l_id == Get_id64(l_panel)) {
      if (l_cmd == "Panel Quit") l_doit = FALSE;
      if (l_cmd == "Panel About") {
        if (about_panel(l_panel, l_about_text, "", 1) == Shutdown_code) return Shutdown_code;
        Set_focus(l_keys);
        l_want_frame = TRUE;
      }
      continue;
    }

    // ------------------------------------------------ mouse and keys to widget actions
    l_act    = DUI_ACT_NONE;
    l_widget = 0;
    if (l_id == Get_id64(l_box)) {
      l_act = dui_mouse(l_ui, l_cmd, l_msg, l_widget);
      if (l_cmd == "click_lb" || l_cmd == "double_click_lb") Set_focus(l_keys);
    } else if (l_id == Get_id64(l_keys)) {
      if (l_cmd == "keystroke") {
        l_act = dui_keystroke(l_ui, l_msg, l_widget);
        Set_data(l_keys, "");
      } else if (l_cmd == "text selected") {
        // Enter in the keys box
        l_act    = DUI_ACT_ENTER;
        l_widget = dui_focus(l_ui);
        Set_data (l_keys, "");
        Set_focus(l_keys);
      }
    }

    // ------------------------------------------------ what the actions do
    switch (l_act) {
      case DUI_ACT_REDRAW : {
        l_want_frame = TRUE;
      } break;

      case DUI_ACT_TICK : {
        l_want_frame = TRUE;
      } break;

      case DUI_ACT_ENTER : {
        // Enter leaves the field
        dui_set_focus(l_ui, 0);
        l_want_frame = TRUE;
      } break;

      case DUI_ACT_CLICK : {
        l_want_frame = TRUE;
        switch (l_widget) {
          case DDP_W_BROWSE_SOURCE : {
            // the folder button opens the file list, or closes it if it is open
            if (dui_popup_owner(l_ui) == DDP_W_BROWSE_SOURCE) {
              dui_popup_close(l_ui);
            } else {
              ddp_browse_open(l_ui);
            }
          } break;
          case DDP_W_COMPILE_DEBUG : {
            ddp_compile_debug(l_panel, l_box, l_message, l_ui, p_theme, l_last_session_dir);
          } break;
          case DDP_W_FINISH : {
            l_doit = FALSE;
          } break;
          case DDP_W_HELP : {
            if (dui_popup_owner(l_ui) == DDP_W_HELP) {
              dui_popup_close(l_ui);
            } else {
              ddp_measure  (l_panel, l_box, l_ui);
              ddp_help_open(l_ui, p_theme);
            }
          } break;
        }
      } break;

      case DUI_ACT_PICK : {
        l_want_frame = TRUE;
        switch (l_widget) {
          case DDP_W_BROWSE_SOURCE : {
            l_path = "";
            if (dui_files_pick(l_ui, l_path)) {
              dui_set_text   (l_ui, DDP_W_MACRO_SOURCE, l_path);
              dui_set_message(l_ui, DDP_W_MESSAGE, "", FALSE);
            }
          } break;
          default : {
            dui_popup_close(l_ui);
          } break;
        }
      } break;
    }
  }

  return 0;
}

#endif

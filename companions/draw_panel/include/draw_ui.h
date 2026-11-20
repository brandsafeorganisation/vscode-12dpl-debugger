#ifndef DRAW_UI_H_INCLUDED
#define DRAW_UI_H_INCLUDED

// ----------------------------------------------------------------
// Draw UI: panel widgets drawn in one Draw_Box
//
// A screen is a record (Attributes) of widgets laid out afresh each
// frame, the way the Cubeland menus do it:
//
//   dui_begin(ui, w, h);                 // forget last frame's widgets
//   dui_add_down(ui, DUI_TICK, MY_ID, ...);  // lay out
//   dui_draw(box, ui, theme);            // draw them (and the popup)
//
// What a widget holds (a field's text, a tick box's tick) is kept
// under its id, so it lasts from frame to frame while the geometry
// is thrown away. Mouse events go through dui_mouse() and keys
// through dui_keystroke(); the controller only sees what they mean
// (DUI_ACT_*).
//
// One popup list can be open on top of the widgets (a choice box's
// list, the file browser in draw_ui_files.4dm, the help text).
//
// Coordinates are the Draw_Box's: x to the right, y UP from the
// bottom left. dui_add_down() takes distances down from the top,
// which is easier for laying out a panel.
// ----------------------------------------------------------------

#ifndef TRUE
#define TRUE  1
#endif
#ifndef FALSE
#define FALSE 0
#endif

// ---------------------------------------------------------------- widget kinds
#define DUI_GROUP    1   // a frame with its title on the top line (draws only)
#define DUI_LABEL    2   // a line of text (draws only)
#define DUI_TICK     3   // a tick box and its label; a click ticks it
#define DUI_FIELD    4   // a one line text box; a click gives it the keyboard
#define DUI_BUTTON   5   // a push button
#define DUI_BROWSE   6   // the folder button at the end of a file field
#define DUI_MESSAGE  7   // the panel's message line

// ---------------------------------------------------------------- what an event did
#define DUI_ACT_NONE    0   // nothing changed
#define DUI_ACT_REDRAW  1   // the look changed (hover, focus, typing, scroll)
#define DUI_ACT_CLICK   2   // a button was clicked; its id comes back
#define DUI_ACT_TICK    3   // a tick box was ticked or unticked; its id comes back
#define DUI_ACT_PICK    4   // a popup row was picked; the popup's owner id comes back
                            // and dui_popup_picked() gives the row's value
#define DUI_ACT_ENTER   5   // Enter was pressed; the focused field's id comes back (0 if none)

// ---------------------------------------------------------------- popup row icons
#define DUI_ICON_NONE    0
#define DUI_ICON_FOLDER  1
#define DUI_ICON_FILE    2
#define DUI_ICON_UP      3

// ---------------------------------------------------------------- popup hit test (dui_popup_at)
#define DUI_POPUP_OUTSIDE  -1
#define DUI_POPUP_FRAME     0
#define DUI_POPUP_CLOSE    -2
#define DUI_POPUP_SCROLL   -3
#define DUI_POPUP_TITLEBAR -4   // the title bar (not the cross): drag it to move the popup

// ---------------------------------------------------------------- sizes, in pixels
#define DUI_TEXT_SIZE      13.0   // the default; a theme can set its own (dui_theme_font)
#define DUI_TICK_SIZE      13.0
#define DUI_POPUP_ROW      20.0
#define DUI_POPUP_TITLE    22.0
#define DUI_POPUP_ROWS     12     // most rows a popup shows at once
#define DUI_POPUP_PIN_MOVE 4.0    // how far the title bar must be dragged before the popup stays open
#define DUI_SCROLL_WIDTH   12.0
#define DUI_FIELD_LONGEST  1024   // most characters a field takes

// ---------------------------------------------------------------- keys as 12d sends them in a "keystroke" message
#define DUI_KEY_COPY        3     // Ctrl+C
#define DUI_KEY_BACKSPACE   8
#define DUI_KEY_TAB         9
#define DUI_KEY_ENTER       13
#define DUI_KEY_PASTE       22    // Ctrl+V
#define DUI_KEY_CUT         24    // Ctrl+X
#define DUI_KEY_ESCAPE      27
#define DUI_KEY_DELETE_WORD 127   // Ctrl+Backspace

// ---------------------------------------------------------------- record field names
#define DUI_DATATYPE_UI      ("draw_ui")
#define DUI_ATTR_DATATYPE    ("datatype")
#define DUI_ATTR_WIDTH       ("box_w")
#define DUI_ATTR_HEIGHT      ("box_h")
#define DUI_ATTR_WIDGETS     ("widgets")
#define DUI_ATTR_FOCUS       ("focus")        // id of the field typing goes to, 0 if none
#define DUI_ATTR_PRESSED     ("pressed")      // widget number the mouse went down on
#define DUI_ATTR_HOVER       ("hover")        // what was under the mouse last time (to see when it changes)
#define DUI_ATTR_MOUSE_X     ("mouse_x")
#define DUI_ATTR_MOUSE_Y     ("mouse_y")
// per widget number: "kind_3" ...
#define DUI_ATTR_KIND        ("kind")
#define DUI_ATTR_ID          ("id")
#define DUI_ATTR_X0          ("x0")
#define DUI_ATTR_Y0          ("y0")
#define DUI_ATTR_X1          ("x1")
#define DUI_ATTR_Y1          ("y1")
#define DUI_ATTR_LABEL       ("label")
#define DUI_ATTR_ENABLED     ("enabled")
// per widget id: "text_12" ...
#define DUI_ATTR_TEXT        ("text")
#define DUI_ATTR_TICKED      ("ticked")
#define DUI_ATTR_ERROR       ("error")        // a message shown as a problem
// the popup
#define DUI_ATTR_POP_OWNER   ("popup_owner")  // id of the widget that opened it, 0 when closed
#define DUI_ATTR_POP_TITLE   ("popup_title")
#define DUI_ATTR_POP_ROWS    ("popup_rows")
#define DUI_ATTR_POP_LABEL   ("popup_label")  // per row
#define DUI_ATTR_POP_VALUE   ("popup_value")  // per row
#define DUI_ATTR_POP_ICON    ("popup_icon")   // per row
#define DUI_ATTR_POP_SCROLL  ("popup_scroll")
#define DUI_ATTR_POP_X0      ("popup_x0")
#define DUI_ATTR_POP_X1      ("popup_x1")
#define DUI_ATTR_POP_TOP     ("popup_top")
#define DUI_ATTR_POP_DRAG    ("popup_drag")
#define DUI_ATTR_POP_PICKED  ("popup_picked")
#define DUI_ATTR_POP_MOVING  ("popup_moving") // the title bar is held down
#define DUI_ATTR_POP_GRAB_X  ("popup_grab_x") // where it was held, from the popup's x0 and top
#define DUI_ATTR_POP_GRAB_Y  ("popup_grab_y")
#define DUI_ATTR_POP_DOWN_X  ("popup_down_x") // where the mouse went down on the title bar
#define DUI_ATTR_POP_DOWN_Y  ("popup_down_y")
#define DUI_ATTR_POP_PINNED  ("popup_pinned") // it was moved, so a click outside doesn't close it

// ---------------------------------------------------------------- draw_ui.4dm
Integer dui_get_integer      (Attributes &p_record, Text p_field);
Real    dui_get_real         (Attributes &p_record, Text p_field);
Text    dui_get_text         (Attributes &p_record, Text p_field);
Text    dui_field_at         (Text p_field, Integer p_index);
Integer dui_min_integer      (Integer p_a, Integer p_b);
Integer dui_max_integer      (Integer p_a, Integer p_b);
void    dui_clear            (Attributes &p_ui);
void    dui_begin            (Attributes &p_ui, Real p_w, Real p_h);
Real    dui_width            (Attributes &p_ui);
Real    dui_height           (Attributes &p_ui);
Integer dui_add              (Attributes &p_ui, Integer p_kind, Integer p_id, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_label, Integer p_enabled);
Integer dui_add_down         (Attributes &p_ui, Integer p_kind, Integer p_id, Real p_x0, Real p_top, Real p_x1, Real p_bottom, Text p_label, Integer p_enabled);
Integer dui_widgets          (Attributes &p_ui);
Integer dui_widget_kind      (Attributes &p_ui, Integer p_widget);
Integer dui_widget_id        (Attributes &p_ui, Integer p_widget);
Integer dui_widget_of        (Attributes &p_ui, Integer p_id);
void    dui_widget_rect      (Attributes &p_ui, Integer p_widget, Real &p_x0, Real &p_y0, Real &p_x1, Real &p_y1);
Integer dui_at               (Attributes &p_ui, Real p_x, Real p_y);
Text    dui_text             (Attributes &p_ui, Integer p_id);
void    dui_set_text         (Attributes &p_ui, Integer p_id, Text p_text);
Integer dui_ticked           (Attributes &p_ui, Integer p_id);
void    dui_set_ticked       (Attributes &p_ui, Integer p_id, Integer p_ticked);
void    dui_set_message      (Attributes &p_ui, Integer p_id, Text p_text, Integer p_error);
Integer dui_is_error         (Attributes &p_ui, Integer p_id);
Integer dui_focus            (Attributes &p_ui);
void    dui_set_focus        (Attributes &p_ui, Integer p_id);
void    dui_focus_next       (Attributes &p_ui);
Integer dui_popup_owner      (Attributes &p_ui);
void    dui_popup_open       (Attributes &p_ui, Integer p_owner, Text p_title, Real p_x0, Real p_top, Real p_x1);
void    dui_popup_set_title  (Attributes &p_ui, Text p_title);
void    dui_popup_clear_rows (Attributes &p_ui);
void    dui_popup_add        (Attributes &p_ui, Text p_label, Text p_value, Integer p_icon);
Integer dui_popup_rows       (Attributes &p_ui);
Integer dui_popup_shown      (Attributes &p_ui);
void    dui_popup_close      (Attributes &p_ui);
Text    dui_popup_picked     (Attributes &p_ui);
void    dui_popup_rect       (Attributes &p_ui, Real &p_x0, Real &p_y0, Real &p_x1, Real &p_y1);
Integer dui_popup_scrolls    (Attributes &p_ui);
void    dui_popup_set_scroll (Attributes &p_ui, Integer p_scroll);
void    dui_popup_scroll_to  (Attributes &p_ui, Real p_y);
Integer dui_popup_at         (Attributes &p_ui, Real p_x, Real p_y);
Integer dui_popup_pinned     (Attributes &p_ui);
Integer dui_popup_modal_at   (Attributes &p_ui, Real p_x, Real p_y);
void    dui_popup_move_to    (Attributes &p_ui, Real p_x, Real p_y);
Integer dui_hover_key        (Attributes &p_ui, Real p_x, Real p_y);
Integer dui_mouse            (Attributes &p_ui, Text p_cmd, Text p_msg, Integer &p_id);
Integer dui_split_xy         (Text p_msg, Real &p_x, Real &p_y);
Integer dui_key_code         (Text p_msg);
Text    dui_first_line       (Text p_text);
Text    dui_without_last_word(Text p_text);
Integer dui_keystroke        (Attributes &p_ui, Text p_msg, Integer &p_id);

// ---------------------------------------------------------------- draw_ui_theme.4dm
#include "draw_ui_theme.h"

// ---------------------------------------------------------------- draw_ui_render.4dm
void    dui_forget_colour    ();
void    dui_use_colour       (Draw_Box p_box, Attributes &p_theme, Text p_role);
void    dui_fill             (Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x0, Real p_y0, Real p_x1, Real p_y1);
void    dui_line             (Draw_Box p_box, Real p_x0, Real p_y0, Real p_x1, Real p_y1);
void    dui_frame            (Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x0, Real p_y0, Real p_x1, Real p_y1);
Real    dui_text_width       (Attributes &p_theme, Text p_text);
Text    dui_fit_text         (Attributes &p_theme, Text p_text, Real p_width);
Text    dui_fit_text_end     (Attributes &p_theme, Text p_text, Real p_width);
Text    dui_without_mnemonic (Text p_text);
void    dui_draw_text        (Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x, Real p_middle, Integer p_centre, Text p_text);
void    dui_draw_folder_icon (Draw_Box p_box, Attributes &p_theme, Real p_x, Real p_middle);
void    dui_draw_file_icon   (Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x, Real p_middle);
void    dui_draw_group       (Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_title);
void    dui_draw_tick        (Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_label, Integer p_ticked, Integer p_hover, Integer p_enabled);
void    dui_draw_field       (Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_text, Integer p_focused, Integer p_hover, Integer p_enabled);
void    dui_draw_button      (Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_label, Integer p_hover, Integer p_pressed, Integer p_enabled, Integer p_folder);
void    dui_draw_message     (Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_text, Integer p_error);
void    dui_draw_popup       (Draw_Box p_box, Attributes &p_ui, Attributes &p_theme);
void    dui_draw             (Draw_Box p_box, Attributes &p_ui, Attributes &p_theme);

// ---------------------------------------------------------------- draw_ui_files.4dm
#define DUI_FILES_DIR_PREFIX   ("d:")
#define DUI_FILES_FILE_PREFIX  ("f:")
#define DUI_ATTR_FILES_FOLDER  ("files_folder")
#define DUI_ATTR_FILES_PATTERN ("files_pattern")

Integer dui_is_separator     (Text p_char);
Text    dui_path_trim        (Text p_path);
Text    dui_path_parent      (Text p_path);
Text    dui_path_leaf        (Text p_path);
Text    dui_path_join        (Text p_folder, Text p_name);
Text    dui_path_unquote     (Text p_path);
Text    dui_files_start      (Text p_typed);
void    dui_files_fill       (Attributes &p_ui, Text p_folder);
void    dui_files_open       (Attributes &p_ui, Integer p_owner, Text p_typed, Text p_pattern, Real p_x0, Real p_top, Real p_x1);
Integer dui_files_pick       (Attributes &p_ui, Text &p_path);

#endif

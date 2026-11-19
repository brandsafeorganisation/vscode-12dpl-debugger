#ifndef DRAW_UI_THEME_H_INCLUDED
#define DRAW_UI_THEME_H_INCLUDED

// ----------------------------------------------------------------
// Draw UI themes: the colours widgets are drawn in, by role.
// A theme is a record with "<role>_r", "<role>_g" and "<role>_b"
// for each role below. Add a theme by adding a case to
// dui_theme_set(); add a role by giving it a colour in every theme.
// ----------------------------------------------------------------

#define DUI_THEME_LIGHT  1
#define DUI_THEME_DARK   2

#define DUI_DATATYPE_THEME  ("draw_ui_theme")
#define DUI_ATTR_THEME      ("theme")

// command line words that pick a theme (any leading - or / is ignored)
#define DUI_ARG_DARK         ("dark")
#define DUI_ARG_LIGHT        ("light")
#define DUI_ARG_THEME_DARK   ("theme=dark")
#define DUI_ARG_THEME_LIGHT  ("theme=light")

// ---------------------------------------------------------------- colour roles
#define DUI_C_BACKGROUND      ("background")      // the panel
#define DUI_C_TEXT            ("text")
#define DUI_C_TEXT_DISABLED   ("text_disabled")
#define DUI_C_ERROR_TEXT      ("error_text")
#define DUI_C_BORDER          ("border")          // fields, tick boxes, buttons
#define DUI_C_ACCENT          ("accent")          // hover and focus edges, the picked row
#define DUI_C_ACCENT_TEXT     ("accent_text")     // text on the accent colour
#define DUI_C_GROUP_LINE      ("group_line")
#define DUI_C_FIELD           ("field")           // inside a field or tick box
#define DUI_C_FIELD_DISABLED  ("field_disabled")
#define DUI_C_CHECK           ("check")           // the tick
#define DUI_C_BUTTON          ("button")
#define DUI_C_BUTTON_HOVER    ("button_hover")
#define DUI_C_BUTTON_PRESSED  ("button_pressed")
#define DUI_C_MESSAGE         ("message")         // inside the message line
#define DUI_C_POPUP           ("popup")
#define DUI_C_POPUP_TITLE     ("popup_title")
#define DUI_C_SHADOW          ("shadow")
#define DUI_C_SCROLL_TRACK    ("scroll_track")
#define DUI_C_SCROLL_THUMB    ("scroll_thumb")
#define DUI_C_FOLDER          ("folder")
#define DUI_C_FOLDER_EDGE     ("folder_edge")
#define DUI_C_CLOSE           ("close")           // the popup's close cross

// ---------------------------------------------------------------- draw_ui_theme.4dm
void    dui_theme_colour       (Attributes &p_theme, Text p_role, Integer p_red, Integer p_green, Integer p_blue);
Integer dui_theme_red          (Attributes &p_theme, Text p_role);
Integer dui_theme_green        (Attributes &p_theme, Text p_role);
Integer dui_theme_blue         (Attributes &p_theme, Text p_role);
Integer dui_theme_kind         (Attributes &p_theme);
void    dui_theme_set          (Attributes &p_theme, Integer p_kind);
Integer dui_theme_from_word    (Text p_word, Integer p_default);
Integer dui_theme_from_arguments(Integer p_default);

#endif

#ifndef DRAW_UI_THEME_H_INCLUDED
#define DRAW_UI_THEME_H_INCLUDED

// ----------------------------------------------------------------
// Draw UI themes: the colours widgets are drawn in, by role.
// A theme is a record with "<role>_r", "<role>_g" and "<role>_b"
// for each role below. Add a theme by adding a case to
// dui_theme_set(); add a role by giving it a colour in every theme.
// ----------------------------------------------------------------

#define DUI_THEME_AUTO   0     // follow 12d's theme (Get_active_theme_name)
#define DUI_THEME_LIGHT  1
#define DUI_THEME_DARK   2

#define DUI_DATATYPE_THEME  ("draw_ui_theme")
#define DUI_ATTR_THEME      ("theme")

// command line words that pick a theme (any leading - or / is ignored)
#define DUI_ARG_DARK         ("dark")
#define DUI_ARG_LIGHT        ("light")
#define DUI_ARG_THEME_DARK   ("theme=dark")
#define DUI_ARG_THEME_LIGHT  ("theme=light")
#define DUI_ARG_AUTO         ("auto")
#define DUI_ARG_THEME_AUTO   ("theme=auto")
#define DUI_ARG_MODERN       ("modern")       // the modern font (DUI_FONT_MODERN)
#define DUI_ARG_FONT         ("font=")        // font=<any installed font>

// ---------------------------------------------------------------- fonts
// 12d can't measure text, so each font has an estimate of how wide
// a character is, per pixel of text size (a little over the average,
// so text is cut short rather than drawn past its box).
#define DUI_ATTR_FONT          ("font")
#define DUI_ATTR_FONT_SIZE     ("font_size")
#define DUI_ATTR_CHAR_WIDTH    ("char_width")

#define DUI_FONT_DEFAULT       ("Segoe UI")   // 12d's own panels
#define DUI_FONT_DEFAULT_WIDTH 0.55
#define DUI_FONT_MODERN        ("Inter")      // free: https://rsms.me/inter
#define DUI_FONT_MODERN_WIDTH  0.59
#define DUI_FONT_OTHER_WIDTH   0.60           // a font given by name

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
Integer dui_theme_from_12d     (Integer p_default);
Integer dui_theme_from_arguments(Integer p_default);
void    dui_theme_font         (Attributes &p_theme, Text p_font, Real p_char_width, Real p_size);
void    dui_theme_font_from_arguments(Attributes &p_theme);
Text    dui_theme_font_name    (Attributes &p_theme);
Real    dui_theme_font_size    (Attributes &p_theme);
Real    dui_theme_char_width   (Attributes &p_theme);
Text    dui_argument_strip     (Text p_word);
Integer dui_has_argument       (Text p_word);
Integer dui_argument_value     (Text p_prefix, Text &p_value);

#endif

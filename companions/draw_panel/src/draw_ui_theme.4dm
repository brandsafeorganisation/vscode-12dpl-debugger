#ifndef DRAW_UI_THEME_4DM_INCLUDED
#define DRAW_UI_THEME_4DM_INCLUDED

#include "../include/draw_ui.h"

// ----------------------------------------------------------------
// Draw UI themes: light (close to 12d's own panels) and dark
// ----------------------------------------------------------------

void dui_theme_colour(Attributes &p_theme, Text p_role, Integer p_red, Integer p_green, Integer p_blue)
// ----------------------------------------------------------------
// Give a role its colour
// ----------------------------------------------------------------
{
  Set_attribute(p_theme, p_role + "_r", p_red);
  Set_attribute(p_theme, p_role + "_g", p_green);
  Set_attribute(p_theme, p_role + "_b", p_blue);
}

Integer dui_theme_red(Attributes &p_theme, Text p_role)
// ----------------------------------------------------------------
{
  return dui_get_integer(p_theme, p_role + "_r");
}

Integer dui_theme_green(Attributes &p_theme, Text p_role)
// ----------------------------------------------------------------
{
  return dui_get_integer(p_theme, p_role + "_g");
}

Integer dui_theme_blue(Attributes &p_theme, Text p_role)
// ----------------------------------------------------------------
{
  return dui_get_integer(p_theme, p_role + "_b");
}

Integer dui_theme_kind(Attributes &p_theme)
// ----------------------------------------------------------------
// DUI_THEME_LIGHT or DUI_THEME_DARK
// ----------------------------------------------------------------
{
  return dui_get_integer(p_theme, DUI_ATTR_THEME);
}

void dui_theme_set(Attributes &p_theme, Integer p_kind)
// ----------------------------------------------------------------
// Fill the theme record with the colours of a theme
// ----------------------------------------------------------------
{
  Attribute_delete_all(p_theme);
  Set_attribute(p_theme, DUI_ATTR_DATATYPE, DUI_DATATYPE_THEME);

  switch (p_kind) {
    case DUI_THEME_DARK : {
      Set_attribute   (p_theme, DUI_ATTR_THEME, DUI_THEME_DARK);
      dui_theme_colour(p_theme, DUI_C_BACKGROUND    ,  32,  32,  32);
      dui_theme_colour(p_theme, DUI_C_TEXT          , 230, 230, 230);
      dui_theme_colour(p_theme, DUI_C_TEXT_DISABLED , 128, 128, 128);
      dui_theme_colour(p_theme, DUI_C_ERROR_TEXT    , 255, 120, 110);
      dui_theme_colour(p_theme, DUI_C_BORDER        , 110, 110, 110);
      dui_theme_colour(p_theme, DUI_C_ACCENT        ,  60, 150, 240);
      dui_theme_colour(p_theme, DUI_C_ACCENT_TEXT   , 255, 255, 255);
      dui_theme_colour(p_theme, DUI_C_GROUP_LINE    ,  72,  72,  72);
      dui_theme_colour(p_theme, DUI_C_FIELD         ,  45,  45,  45);
      dui_theme_colour(p_theme, DUI_C_FIELD_DISABLED,  38,  38,  38);
      dui_theme_colour(p_theme, DUI_C_CHECK         , 120, 190, 255);
      dui_theme_colour(p_theme, DUI_C_BUTTON        ,  58,  58,  58);
      dui_theme_colour(p_theme, DUI_C_BUTTON_HOVER  ,  72,  76,  82);
      dui_theme_colour(p_theme, DUI_C_BUTTON_PRESSED,  30,  60,  92);
      dui_theme_colour(p_theme, DUI_C_MESSAGE       ,  40,  40,  40);
      dui_theme_colour(p_theme, DUI_C_POPUP         ,  43,  43,  43);
      dui_theme_colour(p_theme, DUI_C_POPUP_TITLE   ,  56,  56,  56);
      dui_theme_colour(p_theme, DUI_C_SHADOW        ,  12,  12,  12);
      dui_theme_colour(p_theme, DUI_C_SCROLL_TRACK  ,  50,  50,  50);
      dui_theme_colour(p_theme, DUI_C_SCROLL_THUMB  , 105, 105, 105);
      dui_theme_colour(p_theme, DUI_C_FOLDER        , 214, 170,  70);
      dui_theme_colour(p_theme, DUI_C_FOLDER_EDGE   , 150, 112,  30);
      dui_theme_colour(p_theme, DUI_C_CLOSE         , 232,  72,  60);
    } break;

    default : {
      Set_attribute   (p_theme, DUI_ATTR_THEME, DUI_THEME_LIGHT);
      dui_theme_colour(p_theme, DUI_C_BACKGROUND    , 240, 240, 240);
      dui_theme_colour(p_theme, DUI_C_TEXT          ,   0,   0,   0);
      dui_theme_colour(p_theme, DUI_C_TEXT_DISABLED , 120, 120, 120);
      dui_theme_colour(p_theme, DUI_C_ERROR_TEXT    , 196,  20,  20);
      dui_theme_colour(p_theme, DUI_C_BORDER        , 122, 122, 122);
      dui_theme_colour(p_theme, DUI_C_ACCENT        ,   0, 120, 215);
      dui_theme_colour(p_theme, DUI_C_ACCENT_TEXT   , 255, 255, 255);
      dui_theme_colour(p_theme, DUI_C_GROUP_LINE    , 204, 204, 204);
      dui_theme_colour(p_theme, DUI_C_FIELD         , 255, 255, 255);
      dui_theme_colour(p_theme, DUI_C_FIELD_DISABLED, 244, 244, 244);
      dui_theme_colour(p_theme, DUI_C_CHECK         ,  20,  20,  20);
      dui_theme_colour(p_theme, DUI_C_BUTTON        , 225, 225, 225);
      dui_theme_colour(p_theme, DUI_C_BUTTON_HOVER  , 229, 241, 251);
      dui_theme_colour(p_theme, DUI_C_BUTTON_PRESSED, 204, 228, 247);
      dui_theme_colour(p_theme, DUI_C_MESSAGE       , 250, 250, 250);
      dui_theme_colour(p_theme, DUI_C_POPUP         , 255, 255, 255);
      dui_theme_colour(p_theme, DUI_C_POPUP_TITLE   , 236, 236, 236);
      dui_theme_colour(p_theme, DUI_C_SHADOW        , 170, 170, 170);
      dui_theme_colour(p_theme, DUI_C_SCROLL_TRACK  , 240, 240, 240);
      dui_theme_colour(p_theme, DUI_C_SCROLL_THUMB  , 192, 192, 192);
      dui_theme_colour(p_theme, DUI_C_FOLDER        , 248, 208,  96);
      dui_theme_colour(p_theme, DUI_C_FOLDER_EDGE   , 196, 150,  40);
      dui_theme_colour(p_theme, DUI_C_CLOSE         , 200,  40,  40);
    } break;
  }
}

Integer dui_theme_from_word(Text p_word, Integer p_default)
// ----------------------------------------------------------------
// The theme a command line word asks for ("-dark", "/light",
// "--theme=dark" ...), or p_default if it names none
// ----------------------------------------------------------------
{
  Text    l_word  = Text_lower(p_word);
  Integer l_char  = 0;
  Integer l_theme = p_default;

  // drop leading - and /
  while (Text_length(l_word) > 0) {
    Get_char(l_word, 1, l_char);
    if (l_char != '-' && l_char != '/') break;
    l_word = Get_subtext(l_word, 2, Text_length(l_word));
  }

  if (l_word == DUI_ARG_DARK  || l_word == DUI_ARG_THEME_DARK ) l_theme = DUI_THEME_DARK;
  if (l_word == DUI_ARG_LIGHT || l_word == DUI_ARG_THEME_LIGHT) l_theme = DUI_THEME_LIGHT;

  return l_theme;
}

Integer dui_theme_from_arguments(Integer p_default)
// ----------------------------------------------------------------
// The theme the macro's command line asks for (the last word that
// names one wins), or p_default
// ----------------------------------------------------------------
{
  Integer l_count = Get_number_of_command_arguments();
  Integer l_theme = p_default;
  Integer l_arg   = 0;
  Text    l_word  = "";

  for (l_arg = 1; l_arg <= l_count; ++l_arg) {
    l_word = "";
    if (Get_command_argument(l_arg, l_word) != 0) continue;
    l_theme = dui_theme_from_word(l_word, l_theme);
  }

  return l_theme;
}

#endif

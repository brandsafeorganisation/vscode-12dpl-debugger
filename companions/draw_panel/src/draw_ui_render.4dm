#ifndef DRAW_UI_RENDER_4DM_INCLUDED
#define DRAW_UI_RENDER_4DM_INCLUDED

#include "../include/draw_ui.h"

// ----------------------------------------------------------------
// Draw UI: drawing the widgets and the popup in a Draw_Box.
//
// What was learnt from Cubeland's menus:
// - Draw only between Start_batch_draw and End_batch_draw, and draw
//   the whole box every frame (Clear, then everything).
// - A filled rectangle is a 4 point Draw_polygon with the pen and the
//   fill set to the same colour (so it has no odd coloured edge).
// - Every 12d draw call costs about as much as a polygon, so a colour
//   already set isn't set again (dui_use_colour).
// - Text is placed by its top left (Set_text_align 0) or top centre
//   (6), y up; 12d can't measure text, so widths are estimates.
// - Set_bk_mode(box, 1) draws text without a box behind it.
// ----------------------------------------------------------------

#define DUI_ALIGN_TOP_LEFT    0     // Windows TA_TOP | TA_LEFT
#define DUI_ALIGN_TOP_CENTRE  6     // Windows TA_TOP | TA_CENTER
#define DUI_TEXT_FONT         ("Segoe UI")

{
  Real    g_dui_poly_x[8];
  Real    g_dui_poly_y[8];
  Integer g_dui_colour = -1;   // the colour set last (r * 65536 + g * 256 + b), -1 if unknown
}

// ---------------------------------------------------------------- primitives

void dui_forget_colour()
// ----------------------------------------------------------------
// Forget which colour is set (at the start of every frame), so the
// next dui_use_colour sets it
// ----------------------------------------------------------------
{
  g_dui_colour = -1;
}

void dui_use_colour(Draw_Box p_box, Attributes &p_theme, Text p_role)
// ----------------------------------------------------------------
// Set the pen and the fill to a role's colour
// ----------------------------------------------------------------
{
  Integer l_red    = dui_theme_red  (p_theme, p_role);
  Integer l_green  = dui_theme_green(p_theme, p_role);
  Integer l_blue   = dui_theme_blue (p_theme, p_role);
  Integer l_colour = l_red * 65536 + l_green * 256 + l_blue;

  if (l_colour == g_dui_colour) return;
  g_dui_colour = l_colour;
  Set_colour     (p_box, l_red, l_green, l_blue);
  Set_fill_colour(p_box, l_red, l_green, l_blue);
}

void dui_fill(Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x0, Real p_y0, Real p_x1, Real p_y1)
// ----------------------------------------------------------------
// A filled rectangle in a role's colour
// ----------------------------------------------------------------
{
  dui_use_colour(p_box, p_theme, p_role);
  g_dui_poly_x[1] = p_x0;
  g_dui_poly_y[1] = p_y0;
  g_dui_poly_x[2] = p_x1;
  g_dui_poly_y[2] = p_y0;
  g_dui_poly_x[3] = p_x1;
  g_dui_poly_y[3] = p_y1;
  g_dui_poly_x[4] = p_x0;
  g_dui_poly_y[4] = p_y1;
  Draw_polygon(p_box, 4, g_dui_poly_x, g_dui_poly_y);
}

void dui_line(Draw_Box p_box, Real p_x0, Real p_y0, Real p_x1, Real p_y1)
// ----------------------------------------------------------------
// A line in the pen colour
// ----------------------------------------------------------------
{
  Move_to(p_box, p_x0, p_y0);
  Draw_to(p_box, p_x1, p_y1);
}

void dui_frame(Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x0, Real p_y0, Real p_x1, Real p_y1)
// ----------------------------------------------------------------
// The outline of a rectangle in a role's colour
// ----------------------------------------------------------------
{
  dui_use_colour(p_box, p_theme, p_role);
  dui_line(p_box, p_x0, p_y0, p_x1, p_y0);
  dui_line(p_box, p_x1, p_y0, p_x1, p_y1);
  dui_line(p_box, p_x1, p_y1, p_x0, p_y1);
  dui_line(p_box, p_x0, p_y1, p_x0, p_y0);
}

Real dui_text_width(Text p_text)
// ----------------------------------------------------------------
// About how wide text is (12d can't measure text)
// ----------------------------------------------------------------
{
  return DUI_CHAR_WIDTH * DUI_TEXT_SIZE * Text_length(p_text);
}

Text dui_fit_text(Text p_text, Real p_width)
// ----------------------------------------------------------------
// The text cut short with "..." at the end if it is wider than width
// ----------------------------------------------------------------
{
  Integer l_keep = 0;

  if (dui_text_width(p_text) <= p_width) return p_text;
  l_keep = Floor(p_width / (DUI_CHAR_WIDTH * DUI_TEXT_SIZE)) - 3;
  if (l_keep < 1) return "...";
  return Get_subtext(p_text, 1, l_keep) + "...";
}

Text dui_fit_text_end(Text p_text, Real p_width)
// ----------------------------------------------------------------
// The text cut short with "..." at the start if it is wider than
// width (keeps the end of a path, where the file name is)
// ----------------------------------------------------------------
{
  Integer l_keep   = 0;
  Integer l_length = Text_length(p_text);

  if (dui_text_width(p_text) <= p_width) return p_text;
  l_keep = Floor(p_width / (DUI_CHAR_WIDTH * DUI_TEXT_SIZE)) - 3;
  if (l_keep < 1) return "...";
  return "..." + Get_subtext(p_text, l_length - l_keep + 1, l_length);
}

Text dui_without_mnemonic(Text p_text)
// ----------------------------------------------------------------
// A 12d button label without its & ("&Finish" -> "Finish"; "&&"
// stays one &)
// ----------------------------------------------------------------
{
  Text    l_out    = "";
  Integer l_length = Text_length(p_text);
  Integer l_index  = 1;
  Text    l_char   = "";

  while (l_index <= l_length) {
    l_char = Get_subtext(p_text, l_index, l_index);
    if (l_char == "&" && l_index < l_length) {
      ++l_index;
      l_char = Get_subtext(p_text, l_index, l_index);
    }
    l_out = l_out + l_char;
    ++l_index;
  }
  return l_out;
}

void dui_draw_text(Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x, Real p_middle, Integer p_centre, Text p_text)
// ----------------------------------------------------------------
// Text in a role's colour, centred up and down on y middle; from x
// to the right, or centred on x if p_centre
// ----------------------------------------------------------------
{
  if (p_text == "") return;
  if (p_centre) {
    Set_text_align(p_box, DUI_ALIGN_TOP_CENTRE);
  } else {
    Set_text_align(p_box, DUI_ALIGN_TOP_LEFT);
  }
  Set_text_colour(p_box, dui_theme_red(p_theme, p_role), dui_theme_green(p_theme, p_role), dui_theme_blue(p_theme, p_role));
  Draw_text(p_box, p_x, p_middle + DUI_TEXT_SIZE / 2.0 + 1.0, DUI_TEXT_SIZE, 0.0, p_text);
}

void dui_draw_folder_icon(Draw_Box p_box, Attributes &p_theme, Real p_x, Real p_middle)
// ----------------------------------------------------------------
// A 16 x 12 folder with its left edge at x
// ----------------------------------------------------------------
{
  // the tab, then the body over it
  dui_fill (p_box, p_theme, DUI_C_FOLDER_EDGE, p_x       , p_middle + 3.0, p_x + 7.0 , p_middle + 6.0);
  dui_fill (p_box, p_theme, DUI_C_FOLDER     , p_x       , p_middle - 6.0, p_x + 16.0, p_middle + 4.0);
  dui_frame(p_box, p_theme, DUI_C_FOLDER_EDGE, p_x       , p_middle - 6.0, p_x + 16.0, p_middle + 4.0);
}

void dui_draw_file_icon(Draw_Box p_box, Attributes &p_theme, Text p_role, Real p_x, Real p_middle)
// ----------------------------------------------------------------
// A 12 x 14 page with its left edge at x, outlined in a role's colour
// ----------------------------------------------------------------
{
  dui_fill (p_box, p_theme, DUI_C_FIELD, p_x + 2.0, p_middle - 7.0, p_x + 13.0, p_middle + 7.0);
  dui_frame(p_box, p_theme, p_role     , p_x + 2.0, p_middle - 7.0, p_x + 13.0, p_middle + 7.0);
  dui_line (p_box, p_x + 5.0, p_middle + 2.0, p_x + 10.0, p_middle + 2.0);
  dui_line (p_box, p_x + 5.0, p_middle - 1.0, p_x + 10.0, p_middle - 1.0);
  dui_line (p_box, p_x + 5.0, p_middle - 4.0, p_x + 10.0, p_middle - 4.0);
}

// ---------------------------------------------------------------- widgets

void dui_draw_group(Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_title)
// ----------------------------------------------------------------
// A group's frame, its top line through the middle of its title
// (as 12d draws a vertical group's border)
// ----------------------------------------------------------------
{
  Real l_line  = p_y1 - 9.0;
  Text l_title = dui_fit_text(p_title, p_x1 - p_x0 - 24.0);

  dui_frame(p_box, p_theme, DUI_C_GROUP_LINE, p_x0, p_y0, p_x1, l_line);
  if (l_title == "") return;
  dui_fill     (p_box, p_theme, DUI_C_BACKGROUND, p_x0 + 6.0, l_line - 2.0, p_x0 + 12.0 + dui_text_width(l_title), l_line + 2.0);
  dui_draw_text(p_box, p_theme, DUI_C_TEXT, p_x0 + 9.0, l_line, FALSE, l_title);
}

void dui_draw_tick(Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_label, Integer p_ticked, Integer p_hover, Integer p_enabled)
// ----------------------------------------------------------------
// A tick box at the left with its label after it
// ----------------------------------------------------------------
{
  Real l_middle = (p_y0 + p_y1) / 2.0;
  Real l_bx0    = p_x0 + 1.0;
  Real l_bx1    = l_bx0 + DUI_TICK_SIZE;
  Real l_by0    = l_middle - DUI_TICK_SIZE / 2.0;
  Real l_by1    = l_middle + DUI_TICK_SIZE / 2.0;
  Text l_edge   = DUI_C_BORDER;
  Text l_text   = DUI_C_TEXT;

  if (p_hover) l_edge = DUI_C_ACCENT;
  if (!p_enabled) l_text = DUI_C_TEXT_DISABLED;

  dui_fill (p_box, p_theme, DUI_C_FIELD, l_bx0, l_by0, l_bx1, l_by1);
  dui_frame(p_box, p_theme, l_edge     , l_bx0, l_by0, l_bx1, l_by1);
  if (p_ticked) {
    // a tick, two pixels thick
    dui_use_colour(p_box, p_theme, DUI_C_CHECK);
    dui_line(p_box, l_bx0 + 3.0, l_middle + 0.0, l_bx0 + 5.5, l_middle - 3.0);
    dui_line(p_box, l_bx0 + 5.5, l_middle - 3.0, l_bx1 - 3.0, l_middle + 4.0);
    dui_line(p_box, l_bx0 + 3.0, l_middle - 1.0, l_bx0 + 5.5, l_middle - 4.0);
    dui_line(p_box, l_bx0 + 5.5, l_middle - 4.0, l_bx1 - 3.0, l_middle + 3.0);
  }
  dui_draw_text(p_box, p_theme, l_text, l_bx1 + 6.0, l_middle, FALSE, dui_fit_text(p_label, p_x1 - l_bx1 - 6.0));
}

void dui_draw_field(Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_text, Integer p_focused, Integer p_hover, Integer p_enabled)
// ----------------------------------------------------------------
// A text box; the end of its text stays in view (where typing goes,
// and where a path's file name is). A caret follows the text while
// it has the keyboard.
// ----------------------------------------------------------------
{
  Real l_middle = (p_y0 + p_y1) / 2.0;
  Text l_inside = DUI_C_FIELD;
  Text l_edge   = DUI_C_BORDER;
  Text l_colour = DUI_C_TEXT;
  Text l_text   = dui_fit_text_end(p_text, p_x1 - p_x0 - 12.0);
  Real l_caret  = 0.0;

  if (p_hover  ) l_edge = DUI_C_ACCENT;
  if (p_focused) l_edge = DUI_C_ACCENT;
  if (!p_enabled) {
    l_inside = DUI_C_FIELD_DISABLED;
    l_colour = DUI_C_TEXT_DISABLED;
  }

  dui_fill (p_box, p_theme, l_inside, p_x0, p_y0, p_x1, p_y1);
  dui_frame(p_box, p_theme, l_edge  , p_x0, p_y0, p_x1, p_y1);
  if (p_focused) {
    // a second line on the bottom edge, as Windows 10 does
    dui_line(p_box, p_x0, p_y0 + 1.0, p_x1, p_y0 + 1.0);
  }
  dui_draw_text(p_box, p_theme, l_colour, p_x0 + 5.0, l_middle, FALSE, l_text);
  if (p_focused) {
    l_caret = p_x0 + 6.0 + dui_text_width(l_text);
    if (l_caret > p_x1 - 3.0) l_caret = p_x1 - 3.0;
    dui_use_colour(p_box, p_theme, DUI_C_TEXT);
    dui_line(p_box, l_caret, l_middle - 7.0, l_caret, l_middle + 7.0);
  }
}

void dui_draw_button(Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_label, Integer p_hover, Integer p_pressed, Integer p_enabled, Integer p_folder)
// ----------------------------------------------------------------
// A push button, or with p_folder the folder button of a file field
// ----------------------------------------------------------------
{
  Real l_middle = (p_y0 + p_y1) / 2.0;
  Text l_face   = DUI_C_BUTTON;
  Text l_edge   = DUI_C_BORDER;
  Text l_text   = DUI_C_TEXT;

  if (p_hover) {
    l_face = DUI_C_BUTTON_HOVER;
    l_edge = DUI_C_ACCENT;
  }
  if (p_pressed) l_face = DUI_C_BUTTON_PRESSED;
  if (!p_enabled) {
    l_face = DUI_C_FIELD_DISABLED;
    l_edge = DUI_C_GROUP_LINE;
    l_text = DUI_C_TEXT_DISABLED;
  }

  dui_fill (p_box, p_theme, l_face, p_x0, p_y0, p_x1, p_y1);
  dui_frame(p_box, p_theme, l_edge, p_x0, p_y0, p_x1, p_y1);
  if (p_folder) {
    dui_draw_folder_icon(p_box, p_theme, (p_x0 + p_x1) / 2.0 - 8.0, l_middle);
    return;
  }
  dui_draw_text(p_box, p_theme, l_text, (p_x0 + p_x1) / 2.0, l_middle, TRUE, dui_fit_text(dui_without_mnemonic(p_label), p_x1 - p_x0 - 8.0));
}

void dui_draw_message(Draw_Box p_box, Attributes &p_theme, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_text, Integer p_error)
// ----------------------------------------------------------------
// The message line: sunken, its text red for a problem
// ----------------------------------------------------------------
{
  Text l_colour = DUI_C_TEXT;

  if (p_error) l_colour = DUI_C_ERROR_TEXT;
  dui_fill     (p_box, p_theme, DUI_C_MESSAGE   , p_x0, p_y0, p_x1, p_y1);
  dui_frame    (p_box, p_theme, DUI_C_GROUP_LINE, p_x0, p_y0, p_x1, p_y1);
  dui_draw_text(p_box, p_theme, l_colour, p_x0 + 5.0, (p_y0 + p_y1) / 2.0, FALSE, dui_fit_text(p_text, p_x1 - p_x0 - 10.0));
}

void dui_draw_popup(Draw_Box p_box, Attributes &p_ui, Attributes &p_theme)
// ----------------------------------------------------------------
// The popup list, if one is open: a title bar with a close cross,
// its rows (the one under the mouse lit) and a scroll bar if they
// don't all fit
// ----------------------------------------------------------------
{
  Real    l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;
  Real    l_rows_top = 0.0;
  Real    l_row_top  = 0.0;
  Real    l_middle   = 0.0;
  Real    l_right    = 0.0;
  Real    l_text_x   = 0.0;
  Real    l_track    = 0.0;
  Real    l_thumb    = 0.0;
  Real    l_thumb_top = 0.0;
  Real    l_cx       = 0.0;
  Real    l_cy       = 0.0;
  Integer l_shown    = dui_popup_shown(p_ui);
  Integer l_rows     = dui_popup_rows(p_ui);
  Integer l_scroll   = dui_get_integer(p_ui, DUI_ATTR_POP_SCROLL);
  Integer l_hover    = DUI_POPUP_OUTSIDE;
  Integer l_slot     = 0;
  Integer l_row      = 0;
  Integer l_icon     = 0;
  Text    l_text     = "";
  Text    l_colour   = "";

  if (dui_popup_owner(p_ui) == 0) return;
  dui_popup_rect(p_ui, l_x0, l_y0, l_x1, l_y1);
  l_hover = dui_popup_at(p_ui, dui_get_real(p_ui, DUI_ATTR_MOUSE_X), dui_get_real(p_ui, DUI_ATTR_MOUSE_Y));

  // shadow, body and edge
  dui_fill (p_box, p_theme, DUI_C_SHADOW, l_x0 + 3.0, l_y0 - 3.0, l_x1 + 3.0, l_y1 - 3.0);
  dui_fill (p_box, p_theme, DUI_C_POPUP , l_x0, l_y0, l_x1, l_y1);

  // title bar and close cross (red when the mouse is on it)
  l_rows_top = l_y1 - DUI_POPUP_TITLE;
  dui_fill(p_box, p_theme, DUI_C_POPUP_TITLE, l_x0, l_rows_top, l_x1, l_y1);
  dui_draw_text(p_box, p_theme, DUI_C_TEXT, l_x0 + 6.0, l_rows_top + DUI_POPUP_TITLE / 2.0, FALSE,
                dui_fit_text_end(dui_get_text(p_ui, DUI_ATTR_POP_TITLE), l_x1 - l_x0 - DUI_POPUP_TITLE - 12.0));
  if (l_hover == DUI_POPUP_CLOSE) dui_fill(p_box, p_theme, DUI_C_CLOSE, l_x1 - DUI_POPUP_TITLE, l_rows_top, l_x1, l_y1);
  l_cx = l_x1 - DUI_POPUP_TITLE / 2.0;
  l_cy = l_rows_top + DUI_POPUP_TITLE / 2.0;
  if (l_hover == DUI_POPUP_CLOSE) {
    dui_use_colour(p_box, p_theme, DUI_C_ACCENT_TEXT);
  } else {
    dui_use_colour(p_box, p_theme, DUI_C_CLOSE);
  }
  dui_line(p_box, l_cx - 4.0, l_cy - 4.0, l_cx + 4.0, l_cy + 4.0);
  dui_line(p_box, l_cx - 4.0, l_cy + 4.0, l_cx + 4.0, l_cy - 4.0);

  // rows
  l_right = l_x1 - 1.0;
  if (dui_popup_scrolls(p_ui)) l_right = l_x1 - 1.0 - DUI_SCROLL_WIDTH;
  if (l_rows == 0) {
    dui_draw_text(p_box, p_theme, DUI_C_TEXT_DISABLED, l_x0 + 8.0, l_rows_top - 1.0 - DUI_POPUP_ROW / 2.0, FALSE, "(nothing here)");
  }
  for (l_slot = 1; l_slot <= l_shown; ++l_slot) {
    l_row = l_scroll + l_slot;
    if (l_row > l_rows) break;
    l_row_top = l_rows_top - 1.0 - (l_slot - 1) * DUI_POPUP_ROW;
    l_middle  = l_row_top - DUI_POPUP_ROW / 2.0;
    l_text    = dui_get_text   (p_ui, dui_field_at(DUI_ATTR_POP_LABEL, l_row));
    l_icon    = dui_get_integer(p_ui, dui_field_at(DUI_ATTR_POP_ICON , l_row));
    l_colour  = DUI_C_TEXT;
    if (l_row == l_hover) {
      dui_fill(p_box, p_theme, DUI_C_ACCENT, l_x0 + 1.0, l_row_top - DUI_POPUP_ROW, l_right, l_row_top);
      l_colour = DUI_C_ACCENT_TEXT;
    }
    l_text_x = l_x0 + 6.0;
    if (l_icon == DUI_ICON_FOLDER || l_icon == DUI_ICON_UP) dui_draw_folder_icon(p_box, p_theme, l_x0 + 6.0, l_middle);
    if (l_icon == DUI_ICON_FILE) dui_draw_file_icon(p_box, p_theme, l_colour, l_x0 + 6.0, l_middle);
    if (l_icon != DUI_ICON_NONE) l_text_x = l_x0 + 28.0;
    dui_draw_text(p_box, p_theme, l_colour, l_text_x, l_middle, FALSE, dui_fit_text(l_text, l_right - l_text_x - 4.0));
  }

  // scroll bar
  if (dui_popup_scrolls(p_ui)) {
    l_track = l_rows_top - 1.0 - l_y0 - 1.0;
    l_thumb = l_track * l_shown / l_rows;
    if (l_thumb < 16.0) l_thumb = 16.0;
    l_thumb_top = l_rows_top - 1.0 - (l_track - l_thumb) * l_scroll / (l_rows - l_shown);
    dui_fill(p_box, p_theme, DUI_C_SCROLL_TRACK, l_right, l_y0 + 1.0, l_x1 - 1.0, l_rows_top - 1.0);
    dui_fill(p_box, p_theme, DUI_C_SCROLL_THUMB, l_right + 2.0, l_thumb_top - l_thumb, l_x1 - 3.0, l_thumb_top);
  }

  dui_frame(p_box, p_theme, DUI_C_BORDER, l_x0, l_y0, l_x1, l_y1);
}

void dui_draw(Draw_Box p_box, Attributes &p_ui, Attributes &p_theme)
// ----------------------------------------------------------------
// Draw the whole screen: clear the box, the widgets in the order
// they were added (the one under the mouse lit), then the popup.
// Call between Start_batch_draw and End_batch_draw.
// ----------------------------------------------------------------
{
  Integer l_widget  = 0;
  Integer l_kind    = 0;
  Integer l_id      = 0;
  Integer l_enabled = 0;
  Integer l_hover   = 0;
  Integer l_pressed = dui_get_integer(p_ui, DUI_ATTR_PRESSED);
  Real    l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;
  Text    l_label   = "";

  dui_forget_colour();
  Clear(p_box, dui_theme_red(p_theme, DUI_C_BACKGROUND), dui_theme_green(p_theme, DUI_C_BACKGROUND), dui_theme_blue(p_theme, DUI_C_BACKGROUND));
  Set_text_font(p_box, DUI_TEXT_FONT);
  Set_bk_mode  (p_box, 1);

  // nothing under the popup lights up
  if (dui_popup_owner(p_ui) == 0) l_hover = dui_at(p_ui, dui_get_real(p_ui, DUI_ATTR_MOUSE_X), dui_get_real(p_ui, DUI_ATTR_MOUSE_Y));

  for (l_widget = 1; l_widget <= dui_widgets(p_ui); ++l_widget) {
    l_kind    = dui_widget_kind(p_ui, l_widget);
    l_id      = dui_widget_id  (p_ui, l_widget);
    l_enabled = dui_get_integer(p_ui, dui_field_at(DUI_ATTR_ENABLED, l_widget));
    l_label   = dui_get_text   (p_ui, dui_field_at(DUI_ATTR_LABEL  , l_widget));
    dui_widget_rect(p_ui, l_widget, l_x0, l_y0, l_x1, l_y1);

    switch (l_kind) {
      case DUI_GROUP : {
        dui_draw_group(p_box, p_theme, l_x0, l_y0, l_x1, l_y1, l_label);
      } break;
      case DUI_LABEL : {
        if (l_enabled) {
          dui_draw_text(p_box, p_theme, DUI_C_TEXT, l_x0, (l_y0 + l_y1) / 2.0, FALSE, dui_fit_text(l_label, l_x1 - l_x0));
        } else {
          dui_draw_text(p_box, p_theme, DUI_C_TEXT_DISABLED, l_x0, (l_y0 + l_y1) / 2.0, FALSE, dui_fit_text(l_label, l_x1 - l_x0));
        }
      } break;
      case DUI_TICK : {
        dui_draw_tick(p_box, p_theme, l_x0, l_y0, l_x1, l_y1, l_label, dui_ticked(p_ui, l_id), l_widget == l_hover, l_enabled);
      } break;
      case DUI_FIELD : {
        dui_draw_field(p_box, p_theme, l_x0, l_y0, l_x1, l_y1, dui_text(p_ui, l_id), l_id == dui_focus(p_ui), l_widget == l_hover, l_enabled);
      } break;
      case DUI_BUTTON : {
        dui_draw_button(p_box, p_theme, l_x0, l_y0, l_x1, l_y1, l_label, l_widget == l_hover, l_widget == l_pressed && l_widget == l_hover, l_enabled, FALSE);
      } break;
      case DUI_BROWSE : {
        dui_draw_button(p_box, p_theme, l_x0, l_y0, l_x1, l_y1, l_label, l_widget == l_hover, l_widget == l_pressed && l_widget == l_hover, l_enabled, TRUE);
      } break;
      case DUI_MESSAGE : {
        dui_draw_message(p_box, p_theme, l_x0, l_y0, l_x1, l_y1, dui_text(p_ui, l_id), dui_is_error(p_ui, l_id));
      } break;
    }
  }

  dui_draw_popup(p_box, p_ui, p_theme);
}

#endif

#ifndef DRAW_UI_4DM_INCLUDED
#define DRAW_UI_4DM_INCLUDED

#include "../include/draw_ui.h"

// ----------------------------------------------------------------
// Draw UI: the widget record, the popup list, and what mouse and
// key events do to them. Drawing is in draw_ui_render.4dm.
// ----------------------------------------------------------------

// ---------------------------------------------------------------- record helpers

Integer dui_get_integer(Attributes &p_record, Text p_field)
// ----------------------------------------------------------------
// Integer field of a record, 0 if the record doesn't have it
// ----------------------------------------------------------------
{
  Integer l_value = 0;
  if (Get_attribute(p_record, p_field, l_value) != 0) l_value = 0;
  return l_value;
}

Real dui_get_real(Attributes &p_record, Text p_field)
// ----------------------------------------------------------------
// Real field of a record, 0.0 if the record doesn't have it
// ----------------------------------------------------------------
{
  Real l_value = 0.0;
  if (Get_attribute(p_record, p_field, l_value) != 0) l_value = 0.0;
  return l_value;
}

Text dui_get_text(Attributes &p_record, Text p_field)
// ----------------------------------------------------------------
// Text field of a record, "" if the record doesn't have it
// ----------------------------------------------------------------
{
  Text l_value = "";
  if (Get_attribute(p_record, p_field, l_value) != 0) l_value = "";
  return l_value;
}

Text dui_field_at(Text p_field, Integer p_index)
// ----------------------------------------------------------------
// Field of entity number index: ("x0", 3) -> "x0_3"
// ----------------------------------------------------------------
{
  return p_field + "_" + To_text(p_index);
}

Integer dui_min_integer(Integer p_a, Integer p_b)
// ----------------------------------------------------------------
{
  if (p_a < p_b) return p_a;
  return p_b;
}

Integer dui_max_integer(Integer p_a, Integer p_b)
// ----------------------------------------------------------------
{
  if (p_a > p_b) return p_a;
  return p_b;
}

// ---------------------------------------------------------------- the widget record

void dui_clear(Attributes &p_ui)
// ----------------------------------------------------------------
// An empty screen: no widgets, no text, nothing focused, no popup
// ----------------------------------------------------------------
{
  Attribute_delete_all(p_ui);
  Set_attribute(p_ui, DUI_ATTR_DATATYPE, DUI_DATATYPE_UI);
  Set_attribute(p_ui, DUI_ATTR_WIDTH   , 0.0);
  Set_attribute(p_ui, DUI_ATTR_HEIGHT  , 0.0);
  Set_attribute(p_ui, DUI_ATTR_WIDGETS , 0);
  Set_attribute(p_ui, DUI_ATTR_FOCUS   , 0);
  Set_attribute(p_ui, DUI_ATTR_PRESSED , 0);
  Set_attribute(p_ui, DUI_ATTR_HOVER   , 0);
  Set_attribute(p_ui, DUI_ATTR_MOUSE_X , -1.0);
  Set_attribute(p_ui, DUI_ATTR_MOUSE_Y , -1.0);
  Set_attribute(p_ui, DUI_ATTR_POP_OWNER, 0);
  Set_attribute(p_ui, DUI_ATTR_POP_ROWS , 0);
}

void dui_begin(Attributes &p_ui, Real p_w, Real p_h)
// ----------------------------------------------------------------
// Forget the widgets before the screen is laid out again for a box
// w x h (text, ticks, focus and the popup are kept)
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, DUI_ATTR_WIDTH  , p_w);
  Set_attribute(p_ui, DUI_ATTR_HEIGHT , p_h);
  Set_attribute(p_ui, DUI_ATTR_WIDGETS, 0);
}

Real dui_width(Attributes &p_ui)
// ----------------------------------------------------------------
{
  return dui_get_real(p_ui, DUI_ATTR_WIDTH);
}

Real dui_height(Attributes &p_ui)
// ----------------------------------------------------------------
{
  return dui_get_real(p_ui, DUI_ATTR_HEIGHT);
}

Integer dui_add(Attributes &p_ui, Integer p_kind, Integer p_id, Real p_x0, Real p_y0, Real p_x1, Real p_y1, Text p_label, Integer p_enabled)
// ----------------------------------------------------------------
// Add a widget of a kind (DUI_TICK ...) with the id the controller
// knows it by, covering (x0, y0)..(x1, y1); returns its number
// ----------------------------------------------------------------
{
  Integer l_widget = dui_widgets(p_ui) + 1;

  Set_attribute(p_ui, DUI_ATTR_WIDGETS, l_widget);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_KIND   , l_widget), p_kind);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_ID     , l_widget), p_id);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_X0     , l_widget), p_x0);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_Y0     , l_widget), p_y0);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_X1     , l_widget), p_x1);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_Y1     , l_widget), p_y1);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_LABEL  , l_widget), p_label);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_ENABLED, l_widget), p_enabled);
  return l_widget;
}

Integer dui_add_down(Attributes &p_ui, Integer p_kind, Integer p_id, Real p_x0, Real p_top, Real p_x1, Real p_bottom, Text p_label, Integer p_enabled)
// ----------------------------------------------------------------
// dui_add with the top and bottom given as distances down from the
// top of the box
// ----------------------------------------------------------------
{
  Real l_h = dui_height(p_ui);
  return dui_add(p_ui, p_kind, p_id, p_x0, l_h - p_bottom, p_x1, l_h - p_top, p_label, p_enabled);
}

Integer dui_widgets(Attributes &p_ui)
// ----------------------------------------------------------------
// How many widgets the screen has
// ----------------------------------------------------------------
{
  return dui_get_integer(p_ui, DUI_ATTR_WIDGETS);
}

Integer dui_widget_kind(Attributes &p_ui, Integer p_widget)
// ----------------------------------------------------------------
// The kind of widget number n, 0 if there is none
// ----------------------------------------------------------------
{
  if (p_widget < 1 || p_widget > dui_widgets(p_ui)) return 0;
  return dui_get_integer(p_ui, dui_field_at(DUI_ATTR_KIND, p_widget));
}

Integer dui_widget_id(Attributes &p_ui, Integer p_widget)
// ----------------------------------------------------------------
// The id of widget number n, 0 if there is none
// ----------------------------------------------------------------
{
  if (p_widget < 1 || p_widget > dui_widgets(p_ui)) return 0;
  return dui_get_integer(p_ui, dui_field_at(DUI_ATTR_ID, p_widget));
}

Integer dui_widget_of(Attributes &p_ui, Integer p_id)
// ----------------------------------------------------------------
// The number of the widget with an id, 0 if the screen has none
// ----------------------------------------------------------------
{
  Integer l_widget = 0;

  for (l_widget = 1; l_widget <= dui_widgets(p_ui); ++l_widget) {
    if (dui_get_integer(p_ui, dui_field_at(DUI_ATTR_ID, l_widget)) == p_id) return l_widget;
  }
  return 0;
}

void dui_widget_rect(Attributes &p_ui, Integer p_widget, Real &p_x0, Real &p_y0, Real &p_x1, Real &p_y1)
// ----------------------------------------------------------------
// Where widget number n is
// ----------------------------------------------------------------
{
  p_x0 = dui_get_real(p_ui, dui_field_at(DUI_ATTR_X0, p_widget));
  p_y0 = dui_get_real(p_ui, dui_field_at(DUI_ATTR_Y0, p_widget));
  p_x1 = dui_get_real(p_ui, dui_field_at(DUI_ATTR_X1, p_widget));
  p_y1 = dui_get_real(p_ui, dui_field_at(DUI_ATTR_Y1, p_widget));
}

Integer dui_at(Attributes &p_ui, Real p_x, Real p_y)
// ----------------------------------------------------------------
// The enabled widget you can click at (x, y), 0 if none (the last
// one added wins). Groups, labels and the message line can't be
// clicked.
// ----------------------------------------------------------------
{
  Integer l_widget = 0;
  Integer l_kind   = 0;
  Real    l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;

  for (l_widget = dui_widgets(p_ui); l_widget >= 1; --l_widget) {
    l_kind = dui_widget_kind(p_ui, l_widget);
    if (l_kind == DUI_GROUP || l_kind == DUI_LABEL || l_kind == DUI_MESSAGE) continue;
    if (!dui_get_integer(p_ui, dui_field_at(DUI_ATTR_ENABLED, l_widget))) continue;
    dui_widget_rect(p_ui, l_widget, l_x0, l_y0, l_x1, l_y1);
    if (p_x < l_x0 || p_x > l_x1 || p_y < l_y0 || p_y > l_y1) continue;
    return l_widget;
  }
  return 0;
}

// ---------------------------------------------------------------- what widgets hold, by id

Text dui_text(Attributes &p_ui, Integer p_id)
// ----------------------------------------------------------------
// The text in field (or message) id
// ----------------------------------------------------------------
{
  return dui_get_text(p_ui, dui_field_at(DUI_ATTR_TEXT, p_id));
}

void dui_set_text(Attributes &p_ui, Integer p_id, Text p_text)
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_TEXT, p_id), p_text);
}

Integer dui_ticked(Attributes &p_ui, Integer p_id)
// ----------------------------------------------------------------
// TRUE if tick box id is ticked
// ----------------------------------------------------------------
{
  return dui_get_integer(p_ui, dui_field_at(DUI_ATTR_TICKED, p_id)) != 0;
}

void dui_set_ticked(Attributes &p_ui, Integer p_id, Integer p_ticked)
// ----------------------------------------------------------------
{
  Integer l_ticked = FALSE;
  if (p_ticked) l_ticked = TRUE;
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_TICKED, p_id), l_ticked);
}

void dui_set_message(Attributes &p_ui, Integer p_id, Text p_text, Integer p_error)
// ----------------------------------------------------------------
// Put text in message line id (error: shown as a problem)
// ----------------------------------------------------------------
{
  Integer l_error = FALSE;
  if (p_error) l_error = TRUE;
  dui_set_text(p_ui, p_id, p_text);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_ERROR, p_id), l_error);
}

Integer dui_is_error(Attributes &p_ui, Integer p_id)
// ----------------------------------------------------------------
// TRUE if message line id shows a problem
// ----------------------------------------------------------------
{
  return dui_get_integer(p_ui, dui_field_at(DUI_ATTR_ERROR, p_id)) != 0;
}

Integer dui_focus(Attributes &p_ui)
// ----------------------------------------------------------------
// The id of the field typing goes to, 0 if none
// ----------------------------------------------------------------
{
  return dui_get_integer(p_ui, DUI_ATTR_FOCUS);
}

void dui_set_focus(Attributes &p_ui, Integer p_id)
// ----------------------------------------------------------------
// Send typing to field id (0: to no field)
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, DUI_ATTR_FOCUS, p_id);
}

void dui_focus_next(Attributes &p_ui)
// ----------------------------------------------------------------
// Tab: give the keyboard to the next enabled field in layout order
// (round to the first)
// ----------------------------------------------------------------
{
  Integer l_count   = dui_widgets(p_ui);
  Integer l_current = dui_widget_of(p_ui, dui_focus(p_ui));
  Integer l_step    = 0;
  Integer l_widget  = 0;

  for (l_step = 1; l_step <= l_count; ++l_step) {
    l_widget = l_current + l_step;
    if (l_widget > l_count) l_widget = l_widget - l_count;
    if (dui_widget_kind(p_ui, l_widget) != DUI_FIELD) continue;
    if (!dui_get_integer(p_ui, dui_field_at(DUI_ATTR_ENABLED, l_widget))) continue;
    dui_set_focus(p_ui, dui_widget_id(p_ui, l_widget));
    return;
  }
}

// ---------------------------------------------------------------- the popup list

Integer dui_popup_owner(Attributes &p_ui)
// ----------------------------------------------------------------
// The id of the widget whose popup is open, 0 if none is
// ----------------------------------------------------------------
{
  return dui_get_integer(p_ui, DUI_ATTR_POP_OWNER);
}

void dui_popup_open(Attributes &p_ui, Integer p_owner, Text p_title, Real p_x0, Real p_top, Real p_x1)
// ----------------------------------------------------------------
// Open an empty popup for widget p_owner, from x0 to x1 with its top
// at y top (it moves to stay in the box). Fill it with
// dui_popup_add().
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, DUI_ATTR_POP_OWNER, p_owner);
  Set_attribute(p_ui, DUI_ATTR_POP_X0   , p_x0);
  Set_attribute(p_ui, DUI_ATTR_POP_X1   , p_x1);
  Set_attribute(p_ui, DUI_ATTR_POP_TOP  , p_top);
  Set_attribute(p_ui, DUI_ATTR_POP_DRAG , FALSE);
  Set_attribute(p_ui, DUI_ATTR_POP_MOVING, FALSE);
  Set_attribute(p_ui, DUI_ATTR_POP_PINNED, FALSE);
  Set_attribute(p_ui, DUI_ATTR_POP_PICKED, "");
  dui_popup_set_title (p_ui, p_title);
  dui_popup_clear_rows(p_ui);
  dui_set_focus       (p_ui, 0);
}

void dui_popup_set_title(Attributes &p_ui, Text p_title)
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, DUI_ATTR_POP_TITLE, p_title);
}

void dui_popup_clear_rows(Attributes &p_ui)
// ----------------------------------------------------------------
// Empty the popup (it stays open) and scroll it to the top
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, DUI_ATTR_POP_ROWS  , 0);
  Set_attribute(p_ui, DUI_ATTR_POP_SCROLL, 0);
}

void dui_popup_add(Attributes &p_ui, Text p_label, Text p_value, Integer p_icon)
// ----------------------------------------------------------------
// Add a row showing label (with a DUI_ICON_*); picking it gives
// value. A row with value "" is only text: it isn't lit or picked.
// ----------------------------------------------------------------
{
  Integer l_row = dui_popup_rows(p_ui) + 1;

  Set_attribute(p_ui, DUI_ATTR_POP_ROWS, l_row);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_POP_LABEL, l_row), p_label);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_POP_VALUE, l_row), p_value);
  Set_attribute(p_ui, dui_field_at(DUI_ATTR_POP_ICON , l_row), p_icon);
}

Integer dui_popup_rows(Attributes &p_ui)
// ----------------------------------------------------------------
{
  return dui_get_integer(p_ui, DUI_ATTR_POP_ROWS);
}

Integer dui_popup_shown(Attributes &p_ui)
// ----------------------------------------------------------------
// How many rows fit in the popup at once (at least one, so an empty
// popup still has room to say so)
// ----------------------------------------------------------------
{
  return dui_max_integer(1, dui_min_integer(dui_popup_rows(p_ui), DUI_POPUP_ROWS));
}

void dui_popup_close(Attributes &p_ui)
// ----------------------------------------------------------------
{
  Set_attribute(p_ui, DUI_ATTR_POP_OWNER , 0);
  Set_attribute(p_ui, DUI_ATTR_POP_DRAG  , FALSE);
  Set_attribute(p_ui, DUI_ATTR_POP_MOVING, FALSE);
  Set_attribute(p_ui, DUI_ATTR_POP_PINNED, FALSE);
}

Text dui_popup_picked(Attributes &p_ui)
// ----------------------------------------------------------------
// The value of the row picked last (after DUI_ACT_PICK)
// ----------------------------------------------------------------
{
  return dui_get_text(p_ui, DUI_ATTR_POP_PICKED);
}

void dui_popup_rect(Attributes &p_ui, Real &p_x0, Real &p_y0, Real &p_x1, Real &p_y1)
// ----------------------------------------------------------------
// Where the popup is: as opened (or dragged to), moved to stay
// inside the box
// ----------------------------------------------------------------
{
  Real l_w      = dui_width(p_ui);
  Real l_h      = dui_height(p_ui);
  Real l_height = DUI_POPUP_TITLE + dui_popup_shown(p_ui) * DUI_POPUP_ROW + 2.0;
  Real l_shift  = 0.0;

  p_x0 = dui_get_real(p_ui, DUI_ATTR_POP_X0);
  p_x1 = dui_get_real(p_ui, DUI_ATTR_POP_X1);
  p_y1 = dui_get_real(p_ui, DUI_ATTR_POP_TOP);

  if (p_x1 > l_w - 2.0) {
    l_shift = p_x1 - (l_w - 2.0);
    p_x0 = p_x0 - l_shift;
    p_x1 = p_x1 - l_shift;
  }
  if (p_x0 < 2.0) p_x0 = 2.0;
  if (p_y1 - l_height < 2.0) p_y1 = l_height + 2.0;
  if (p_y1 > l_h - 2.0) p_y1 = l_h - 2.0;
  p_y0 = p_y1 - l_height;
}

Integer dui_popup_scrolls(Attributes &p_ui)
// ----------------------------------------------------------------
// TRUE if the popup has more rows than it shows (so a scroll bar)
// ----------------------------------------------------------------
{
  return dui_popup_rows(p_ui) > dui_popup_shown(p_ui);
}

void dui_popup_set_scroll(Attributes &p_ui, Integer p_scroll)
// ----------------------------------------------------------------
// Scroll past p_scroll rows, keeping the last row at the bottom at most
// ----------------------------------------------------------------
{
  Integer l_most   = dui_max_integer(0, dui_popup_rows(p_ui) - dui_popup_shown(p_ui));
  Integer l_scroll = dui_max_integer(0, dui_min_integer(p_scroll, l_most));

  Set_attribute(p_ui, DUI_ATTR_POP_SCROLL, l_scroll);
}

void dui_popup_scroll_to(Attributes &p_ui, Real p_y)
// ----------------------------------------------------------------
// Scroll so the scroll bar's thumb is at height y (dragging it)
// ----------------------------------------------------------------
{
  Real    l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;
  Real    l_top    = 0.0;
  Real    l_value  = 0.0;
  Integer l_most   = dui_max_integer(0, dui_popup_rows(p_ui) - dui_popup_shown(p_ui));
  Integer l_scroll = 0;

  dui_popup_rect(p_ui, l_x0, l_y0, l_x1, l_y1);
  l_top = l_y1 - DUI_POPUP_TITLE - 1.0;
  if (l_top - l_y0 < 2.0) return;
  l_value = (l_top - p_y) / (l_top - l_y0 - 1.0);
  if (l_value < 0.0) l_value = 0.0;
  if (l_value > 1.0) l_value = 1.0;
  l_scroll = Floor(l_value * l_most + 0.5);
  dui_popup_set_scroll(p_ui, l_scroll);
}

Integer dui_popup_at(Attributes &p_ui, Real p_x, Real p_y)
// ----------------------------------------------------------------
// What of the popup is at (x, y): a row number (1 up), or
// DUI_POPUP_OUTSIDE, DUI_POPUP_CLOSE (the cross), DUI_POPUP_TITLEBAR
// (the rest of the title bar), DUI_POPUP_SCROLL (the scroll bar) or
// DUI_POPUP_FRAME (anything else)
// ----------------------------------------------------------------
{
  Real    l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;
  Real    l_rows_top = 0.0;
  Integer l_row      = 0;

  if (dui_popup_owner(p_ui) == 0) return DUI_POPUP_OUTSIDE;
  dui_popup_rect(p_ui, l_x0, l_y0, l_x1, l_y1);
  if (p_x < l_x0 || p_x > l_x1 || p_y < l_y0 || p_y > l_y1) return DUI_POPUP_OUTSIDE;

  l_rows_top = l_y1 - DUI_POPUP_TITLE;
  if (p_y > l_rows_top) {
    if (p_x > l_x1 - DUI_POPUP_TITLE) return DUI_POPUP_CLOSE;
    return DUI_POPUP_TITLEBAR;
  }
  if (dui_popup_scrolls(p_ui)) {
    if (p_x > l_x1 - 1.0 - DUI_SCROLL_WIDTH) return DUI_POPUP_SCROLL;
  }
  l_row = Floor((l_rows_top - 1.0 - p_y) / DUI_POPUP_ROW) + 1;
  if (l_row < 1 || l_row > dui_popup_shown(p_ui)) return DUI_POPUP_FRAME;
  l_row = l_row + dui_get_integer(p_ui, DUI_ATTR_POP_SCROLL);
  if (l_row > dui_popup_rows(p_ui)) return DUI_POPUP_FRAME;
  // a row with no value is only text (it can't be picked)
  if (dui_get_text(p_ui, dui_field_at(DUI_ATTR_POP_VALUE, l_row)) == "") return DUI_POPUP_FRAME;
  return l_row;
}

Integer dui_popup_pinned(Attributes &p_ui)
// ----------------------------------------------------------------
// TRUE once the popup has been dragged by its title bar: it then
// stays open when something else is clicked (else a click outside
// it closes it, like a choice box's list)
// ----------------------------------------------------------------
{
  if (dui_popup_owner(p_ui) == 0) return FALSE;
  return dui_get_integer(p_ui, DUI_ATTR_POP_PINNED);
}

Integer dui_popup_modal_at(Attributes &p_ui, Real p_x, Real p_y)
// ----------------------------------------------------------------
// TRUE if the popup keeps the mouse at (x, y) from the widgets: it
// is over them, it isn't pinned (a click anywhere goes to it), or
// it is being dragged
// ----------------------------------------------------------------
{
  if (dui_popup_owner(p_ui) == 0) return FALSE;
  if (!dui_popup_pinned(p_ui)) return TRUE;
  if (dui_get_integer(p_ui, DUI_ATTR_POP_MOVING)) return TRUE;
  if (dui_popup_at(p_ui, p_x, p_y) != DUI_POPUP_OUTSIDE) return TRUE;
  return FALSE;
}

void dui_popup_move_to(Attributes &p_ui, Real p_x, Real p_y)
// ----------------------------------------------------------------
// Drag the popup: the point of its title bar that was grabbed goes
// to (x, y), as far as the box lets it. Once it has moved a few
// pixels it is pinned.
// ----------------------------------------------------------------
{
  Real l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;
  Real l_width = dui_get_real(p_ui, DUI_ATTR_POP_X1) - dui_get_real(p_ui, DUI_ATTR_POP_X0);
  Real l_left  = p_x - dui_get_real(p_ui, DUI_ATTR_POP_GRAB_X);
  Real l_dx    = p_x - dui_get_real(p_ui, DUI_ATTR_POP_DOWN_X);
  Real l_dy    = p_y - dui_get_real(p_ui, DUI_ATTR_POP_DOWN_Y);

  if (l_dx * l_dx + l_dy * l_dy >= DUI_POPUP_PIN_MOVE * DUI_POPUP_PIN_MOVE) Set_attribute(p_ui, DUI_ATTR_POP_PINNED, TRUE);

  Set_attribute(p_ui, DUI_ATTR_POP_X0 , l_left);
  Set_attribute(p_ui, DUI_ATTR_POP_X1 , l_left + l_width);
  Set_attribute(p_ui, DUI_ATTR_POP_TOP, p_y + dui_get_real(p_ui, DUI_ATTR_POP_GRAB_Y));

  // keep where it is drawn (inside the box), so it doesn't lag behind
  // the mouse when the mouse comes back from past the edge
  dui_popup_rect(p_ui, l_x0, l_y0, l_x1, l_y1);
  Set_attribute(p_ui, DUI_ATTR_POP_X0 , l_x0);
  Set_attribute(p_ui, DUI_ATTR_POP_X1 , l_x1);
  Set_attribute(p_ui, DUI_ATTR_POP_TOP, l_y1);
}

// ---------------------------------------------------------------- mouse

Integer dui_hover_key(Attributes &p_ui, Real p_x, Real p_y)
// ----------------------------------------------------------------
// A number for what is under the mouse: the popup's part if it is
// open, else the widget. Only used to see when it changes.
// ----------------------------------------------------------------
{
  if (dui_popup_modal_at(p_ui, p_x, p_y)) return 100000 + dui_popup_at(p_ui, p_x, p_y);
  return dui_at(p_ui, p_x, p_y);
}

Integer dui_split_xy(Text p_msg, Real &p_x, Real &p_y)
// ----------------------------------------------------------------
// Read "x y" from a Draw_Box event's message; TRUE if found
// ----------------------------------------------------------------
{
  Integer l_space = Find_text(p_msg, " ");

  if (l_space <= 1) return FALSE;
  From_text(Get_subtext(p_msg, 1, l_space - 1), p_x);
  From_text(Get_subtext(p_msg, l_space + 1, Text_length(p_msg)), p_y);
  return TRUE;
}

Integer dui_mouse(Attributes &p_ui, Text p_cmd, Text p_msg, Integer &p_id)
// ----------------------------------------------------------------
// Do what a Draw_Box mouse event does to the screen: light what the
// mouse is over, tick tick boxes, focus fields, scroll and pick from
// the popup. Returns DUI_ACT_* and, for a click, tick or pick, the
// widget's id in p_id.
// ----------------------------------------------------------------
{
  Real    l_x       = 0.0;
  Real    l_y       = 0.0;
  Integer l_widget  = 0;
  Integer l_kind    = 0;
  Integer l_id      = 0;
  Integer l_hover   = 0;
  Integer l_changed = FALSE;
  Integer l_part    = 0;
  Integer l_scroll  = 0;
  Real    l_x0 = 0.0, l_y0 = 0.0, l_x1 = 0.0, l_y1 = 0.0;

  p_id = 0;

  if (p_cmd == "mouse_leave") {
    Set_attribute(p_ui, DUI_ATTR_MOUSE_X, -1.0);
    Set_attribute(p_ui, DUI_ATTR_MOUSE_Y, -1.0);
    Set_attribute(p_ui, DUI_ATTR_HOVER  , 0);
    Set_attribute(p_ui, DUI_ATTR_PRESSED, 0);
    return DUI_ACT_REDRAW;
  }
  if (!dui_split_xy(p_msg, l_x, l_y)) return DUI_ACT_NONE;

  Set_attribute(p_ui, DUI_ATTR_MOUSE_X, l_x);
  Set_attribute(p_ui, DUI_ATTR_MOUSE_Y, l_y);
  l_hover = dui_hover_key(p_ui, l_x, l_y);
  if (l_hover != dui_get_integer(p_ui, DUI_ATTR_HOVER)) l_changed = TRUE;
  Set_attribute(p_ui, DUI_ATTR_HOVER, l_hover);

  // ------------------------------------------------ moving
  if (p_cmd == "mouse_move") {
    if (dui_get_integer(p_ui, DUI_ATTR_POP_MOVING)) {
      dui_popup_move_to(p_ui, l_x, l_y);
      return DUI_ACT_REDRAW;
    }
    if (dui_get_integer(p_ui, DUI_ATTR_POP_DRAG)) {
      dui_popup_scroll_to(p_ui, l_y);
      return DUI_ACT_REDRAW;
    }
    if (l_changed) return DUI_ACT_REDRAW;
    return DUI_ACT_NONE;
  }

  // ------------------------------------------------ the button goes down
  if (p_cmd == "click_lb_down") {
    if (dui_popup_modal_at(p_ui, l_x, l_y)) {
      l_part = dui_popup_at(p_ui, l_x, l_y);
      if (l_part == DUI_POPUP_SCROLL) {
        Set_attribute(p_ui, DUI_ATTR_POP_DRAG, TRUE);
        dui_popup_scroll_to(p_ui, l_y);
      }
      if (l_part == DUI_POPUP_TITLEBAR) {
        // hold the title bar to drag the popup
        dui_popup_rect(p_ui, l_x0, l_y0, l_x1, l_y1);
        Set_attribute(p_ui, DUI_ATTR_POP_MOVING, TRUE);
        Set_attribute(p_ui, DUI_ATTR_POP_GRAB_X, l_x - l_x0);
        Set_attribute(p_ui, DUI_ATTR_POP_GRAB_Y, l_y1 - l_y);
        Set_attribute(p_ui, DUI_ATTR_POP_DOWN_X, l_x);
        Set_attribute(p_ui, DUI_ATTR_POP_DOWN_Y, l_y);
      }
      return DUI_ACT_REDRAW;
    }
    Set_attribute(p_ui, DUI_ATTR_PRESSED, dui_at(p_ui, l_x, l_y));
    return DUI_ACT_REDRAW;
  }

  // ------------------------------------------------ a click (the button comes up)
  if (p_cmd != "click_lb" && p_cmd != "double_click_lb") {
    if (l_changed) return DUI_ACT_REDRAW;
    return DUI_ACT_NONE;
  }
  Set_attribute(p_ui, DUI_ATTR_PRESSED, 0);

  if (dui_get_integer(p_ui, DUI_ATTR_POP_MOVING)) {
    Set_attribute(p_ui, DUI_ATTR_POP_MOVING, FALSE);
    return DUI_ACT_REDRAW;
  }
  if (dui_popup_modal_at(p_ui, l_x, l_y)) {
    if (dui_get_integer(p_ui, DUI_ATTR_POP_DRAG)) {
      Set_attribute(p_ui, DUI_ATTR_POP_DRAG, FALSE);
      return DUI_ACT_REDRAW;
    }
    // a double click's second half would pick from the list it changed to
    if (p_cmd == "double_click_lb") return DUI_ACT_NONE;
    l_part = dui_popup_at(p_ui, l_x, l_y);
    if (l_part > 0) {
      Set_attribute(p_ui, DUI_ATTR_POP_PICKED, dui_get_text(p_ui, dui_field_at(DUI_ATTR_POP_VALUE, l_part)));
      p_id = dui_popup_owner(p_ui);
      return DUI_ACT_PICK;
    }
    // a click outside closes it (unless it was dragged: then it is
    // pinned, and the click goes to the widgets below)
    if (l_part == DUI_POPUP_OUTSIDE || l_part == DUI_POPUP_CLOSE) {
      dui_popup_close(p_ui);
      Set_attribute(p_ui, DUI_ATTR_HOVER, dui_at(p_ui, l_x, l_y));
      return DUI_ACT_REDRAW;
    }
    if (l_part == DUI_POPUP_SCROLL) {
      // a click on the track pages up or down
      dui_popup_rect(p_ui, l_x0, l_y0, l_x1, l_y1);
      l_scroll = dui_get_integer(p_ui, DUI_ATTR_POP_SCROLL);
      if (l_y > (l_y0 + l_y1) / 2.0) {
        dui_popup_set_scroll(p_ui, l_scroll - dui_popup_shown(p_ui));
      } else {
        dui_popup_set_scroll(p_ui, l_scroll + dui_popup_shown(p_ui));
      }
      return DUI_ACT_REDRAW;
    }
    return DUI_ACT_NONE;
  }

  l_widget = dui_at(p_ui, l_x, l_y);
  l_kind   = dui_widget_kind(p_ui, l_widget);
  l_id     = dui_widget_id(p_ui, l_widget);

  switch (l_kind) {
    case DUI_FIELD : {
      dui_set_focus(p_ui, l_id);
      return DUI_ACT_REDRAW;
    } break;
    case DUI_TICK : {
      dui_set_ticked(p_ui, l_id, !dui_ticked(p_ui, l_id));
      p_id = l_id;
      return DUI_ACT_TICK;
    } break;
    case DUI_BUTTON : {
      p_id = l_id;
      return DUI_ACT_CLICK;
    } break;
    case DUI_BROWSE : {
      p_id = l_id;
      return DUI_ACT_CLICK;
    } break;
  }

  // a click on nothing takes the keyboard from the fields
  dui_set_focus(p_ui, 0);
  return DUI_ACT_REDRAW;
}

// ---------------------------------------------------------------- keys

Integer dui_key_code(Text p_msg)
// ----------------------------------------------------------------
// The character code of a one character keystroke message, 0 if it
// isn't one character
// ----------------------------------------------------------------
{
  Integer l_code = 0;

  if (Text_length(p_msg) != 1) return 0;
  Get_char(p_msg, 1, l_code);
  return l_code;
}

Text dui_first_line(Text p_text)
// ----------------------------------------------------------------
// Text up to its first line break (pasting into a one line field)
// ----------------------------------------------------------------
{
  Integer l_length = Text_length(p_text);
  Integer l_index  = 0;
  Integer l_code   = 0;

  for (l_index = 1; l_index <= l_length; ++l_index) {
    Get_char(p_text, l_index, l_code);
    if (l_code == 10 || l_code == 13) {
      if (l_index == 1) return "";
      return Get_subtext(p_text, 1, l_index - 1);
    }
  }
  return p_text;
}

Text dui_without_last_word(Text p_text)
// ----------------------------------------------------------------
// Ctrl+Backspace: the text without its last word (and the spaces
// after it), as Windows does
// ----------------------------------------------------------------
{
  Integer l_end = Text_length(p_text);

  while (l_end > 0) {
    if (Get_subtext(p_text, l_end, l_end) != " ") break;
    --l_end;
  }
  while (l_end > 0) {
    if (Get_subtext(p_text, l_end, l_end) == " ") break;
    --l_end;
  }
  if (l_end <= 0) return "";
  return Get_subtext(p_text, 1, l_end);
}

Integer dui_keystroke(Attributes &p_ui, Text p_msg, Integer &p_id)
// ----------------------------------------------------------------
// Do what a "keystroke" from the keys box does: type into the
// focused field (Backspace, Ctrl+Backspace, Ctrl+C / Ctrl+X / Ctrl+V
// with the clipboard), Tab to the next field, Escape to close the
// popup or leave the field. Enter returns DUI_ACT_ENTER with the
// focused field's id. Returns DUI_ACT_*.
// ----------------------------------------------------------------
{
  Integer l_code  = dui_key_code(p_msg);
  Integer l_focus = dui_focus(p_ui);
  Text    l_text  = "";
  Text    l_paste = "";

  p_id = 0;

  if (l_code == DUI_KEY_ESCAPE) {
    // beside a pinned popup, a field is left before the popup closes
    if (l_focus != 0 && dui_popup_pinned(p_ui)) {
      dui_set_focus(p_ui, 0);
      return DUI_ACT_REDRAW;
    }
    if (dui_popup_owner(p_ui) != 0) {
      dui_popup_close(p_ui);
      return DUI_ACT_REDRAW;
    }
    if (l_focus != 0) {
      dui_set_focus(p_ui, 0);
      return DUI_ACT_REDRAW;
    }
    return DUI_ACT_NONE;
  }
  // an open popup takes the keys from the fields, unless it is pinned
  if (dui_popup_owner(p_ui) != 0 && !dui_popup_pinned(p_ui)) return DUI_ACT_NONE;

  if (l_code == DUI_KEY_ENTER) {
    p_id = l_focus;
    return DUI_ACT_ENTER;
  }
  if (l_code == DUI_KEY_TAB) {
    dui_focus_next(p_ui);
    return DUI_ACT_REDRAW;
  }
  if (l_focus == 0) return DUI_ACT_NONE;

  l_text = dui_text(p_ui, l_focus);
  switch (l_code) {
    case DUI_KEY_BACKSPACE : {
      if (Text_length(l_text) > 0) l_text = Get_subtext(l_text, 1, Text_length(l_text) - 1);
    } break;
    case DUI_KEY_DELETE_WORD : {
      l_text = dui_without_last_word(l_text);
    } break;
    case DUI_KEY_COPY : {
      Set_clipboard_text(l_text);
      return DUI_ACT_NONE;
    } break;
    case DUI_KEY_CUT : {
      Set_clipboard_text(l_text);
      l_text = "";
    } break;
    case DUI_KEY_PASTE : {
      if (Get_clipboard_text(l_paste) == 0) l_text = l_text + dui_first_line(l_paste);
    } break;
    default : {
      // anything else that types a character goes on the end
      if (l_code < 32) return DUI_ACT_NONE;
      l_text = l_text + p_msg;
    } break;
  }
  if (Text_length(l_text) > DUI_FIELD_LONGEST) l_text = Get_subtext(l_text, 1, DUI_FIELD_LONGEST);
  dui_set_text(p_ui, l_focus, l_text);
  return DUI_ACT_REDRAW;
}

#endif

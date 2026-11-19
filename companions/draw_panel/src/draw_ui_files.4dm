#ifndef DRAW_UI_FILES_4DM_INCLUDED
#define DRAW_UI_FILES_4DM_INCLUDED

#include "../include/draw_ui.h"

// ----------------------------------------------------------------
// Draw UI: a file browser in the popup list, for the folder button
// of a file field (12d's File_Box opens its own dialog, which a
// Draw_Box can't).
//
//   on the folder button's DUI_ACT_CLICK:
//     dui_files_open(ui, id, typed_path, "*.4dm", x0, top, x1);
//   on DUI_ACT_PICK for that id:
//     if (dui_files_pick(ui, path)) { the file was picked }
//
// The first row goes up a folder, then come the sub folders, then
// the files that match the pattern. Picking a folder shows it.
// ----------------------------------------------------------------

Integer dui_is_separator(Text p_char)
// ----------------------------------------------------------------
// TRUE for \ and /
// ----------------------------------------------------------------
{
  return p_char == "\\" || p_char == "/";
}

Text dui_path_trim(Text p_path)
// ----------------------------------------------------------------
// The path without separators (or a "\.") on its end (but "C:\"
// keeps its \)
// ----------------------------------------------------------------
{
  Text    l_path   = p_path;
  Integer l_length = Text_length(l_path);

  while (l_length > 1) {
    if (Get_subtext(l_path, l_length, l_length) == ".") {
      if (!dui_is_separator(Get_subtext(l_path, l_length - 1, l_length - 1))) break;
      l_path   = Get_subtext(l_path, 1, l_length - 1);
      l_length = Text_length(l_path);
      continue;
    }
    if (!dui_is_separator(Get_subtext(l_path, l_length, l_length))) break;
    if (l_length == 3) {
      if (Get_subtext(l_path, 2, 2) == ":") break;
    }
    l_path   = Get_subtext(l_path, 1, l_length - 1);
    l_length = Text_length(l_path);
  }
  return l_path;
}

Text dui_path_parent(Text p_path)
// ----------------------------------------------------------------
// The folder a path is in ("C:\a\b.4dm" -> "C:\a", "C:\a" -> "C:\"),
// "" if it has none
// ----------------------------------------------------------------
{
  Text    l_path  = dui_path_trim(p_path);
  Integer l_index = Text_length(l_path);

  while (l_index > 0) {
    if (dui_is_separator(Get_subtext(l_path, l_index, l_index))) break;
    --l_index;
  }
  if (l_index <= 0) return "";
  if (l_index == Text_length(l_path)) return "";       // a drive's root: "C:\"
  if (l_index == 3) {
    if (Get_subtext(l_path, 2, 2) == ":") return Get_subtext(l_path, 1, 3);
  }
  if (l_index == 1) return Get_subtext(l_path, 1, 1);
  return Get_subtext(l_path, 1, l_index - 1);
}

Text dui_path_leaf(Text p_path)
// ----------------------------------------------------------------
// The last part of a path ("C:\a\b.4dm" -> "b.4dm")
// ----------------------------------------------------------------
{
  Text    l_path   = dui_path_trim(p_path);
  Integer l_length = Text_length(l_path);
  Integer l_index  = l_length;

  while (l_index > 0) {
    if (dui_is_separator(Get_subtext(l_path, l_index, l_index))) break;
    --l_index;
  }
  if (l_index <= 0) return l_path;
  if (l_index >= l_length) return l_path;
  return Get_subtext(l_path, l_index + 1, l_length);
}

Text dui_path_join(Text p_folder, Text p_name)
// ----------------------------------------------------------------
// A name in a folder
// ----------------------------------------------------------------
{
  Integer l_length = Text_length(p_folder);

  if (l_length == 0) return p_name;
  if (dui_is_separator(Get_subtext(p_folder, l_length, l_length))) return p_folder + p_name;
  return p_folder + "\\" + p_name;
}

Text dui_path_unquote(Text p_path)
// ----------------------------------------------------------------
// A typed or pasted path without the spaces round it, or the quotes
// Explorer's "Copy as path" puts round it
// ----------------------------------------------------------------
{
  Text    l_path   = Text_justify(p_path);
  Integer l_length = Text_length(l_path);

  if (l_length >= 2) {
    if (Get_subtext(l_path, 1, 1) == "\"" && Get_subtext(l_path, l_length, l_length) == "\"") {
      l_path = Text_justify(Get_subtext(l_path, 2, l_length - 1));
    }
  }
  return l_path;
}

Text dui_files_start(Text p_typed)
// ----------------------------------------------------------------
// The folder to start browsing in: the typed folder or the folder
// of the typed file, else the project folder, else the user's
// ----------------------------------------------------------------
{
  Text l_typed  = dui_path_unquote(p_typed);
  Text l_folder = "";

  if (l_typed != "") {
    l_typed = Get_absolute_path(l_typed);
    if (Directory_exists(l_typed)) return dui_path_trim(l_typed);
    l_folder = dui_path_parent(l_typed);
    if (l_folder != "") {
      if (Directory_exists(l_folder)) return l_folder;
    }
  }
  l_folder = Get_absolute_path(".");
  if (l_folder != "") {
    if (Directory_exists(l_folder)) return dui_path_trim(l_folder);
  }
  return Getenv("USERPROFILE");
}

void dui_files_fill(Attributes &p_ui, Text p_folder)
// ----------------------------------------------------------------
// Show a folder in the open popup: up a folder, the sub folders,
// then the files that match the pattern given to dui_files_open
// ----------------------------------------------------------------
{
  Text         l_pattern = dui_get_text(p_ui, DUI_ATTR_FILES_PATTERN);
  Text         l_parent  = dui_path_parent(p_folder);
  Text         l_name    = "";
  Integer      l_count   = 0;
  Integer      l_index   = 0;
  Dynamic_Text l_folders;
  Dynamic_Text l_files;

  Set_attribute       (p_ui, DUI_ATTR_FILES_FOLDER, p_folder);
  dui_popup_set_title (p_ui, p_folder);
  dui_popup_clear_rows(p_ui);

  if (l_parent != "") dui_popup_add(p_ui, "..", DUI_FILES_DIR_PREFIX + l_parent, DUI_ICON_UP);

  l_count = 0;
  if (List_subfolders_in_folder(p_folder, "*", l_count, l_folders) == 0) {
    for (l_index = 1; l_index <= l_count; ++l_index) {
      l_name = "";
      Get_item(l_folders, l_index, l_name);
      l_name = dui_path_leaf(l_name);
      if (l_name == "" || l_name == "." || l_name == "..") continue;
      dui_popup_add(p_ui, l_name, DUI_FILES_DIR_PREFIX + dui_path_join(p_folder, l_name), DUI_ICON_FOLDER);
    }
  }

  l_count = 0;
  if (List_files_in_folder(p_folder, l_pattern, l_count, l_files) == 0) {
    for (l_index = 1; l_index <= l_count; ++l_index) {
      l_name = "";
      Get_item(l_files, l_index, l_name);
      l_name = dui_path_leaf(l_name);
      if (l_name == "") continue;
      dui_popup_add(p_ui, l_name, DUI_FILES_FILE_PREFIX + dui_path_join(p_folder, l_name), DUI_ICON_FILE);
    }
  }
}

void dui_files_open(Attributes &p_ui, Integer p_owner, Text p_typed, Text p_pattern, Real p_x0, Real p_top, Real p_x1)
// ----------------------------------------------------------------
// Open the file browser for widget p_owner (see dui_popup_open for
// where), starting from what is typed in the field
// ----------------------------------------------------------------
{
  dui_popup_open(p_ui, p_owner, "", p_x0, p_top, p_x1);
  Set_attribute (p_ui, DUI_ATTR_FILES_PATTERN, p_pattern);
  dui_files_fill(p_ui, dui_files_start(p_typed));
}

Integer dui_files_pick(Attributes &p_ui, Text &p_path)
// ----------------------------------------------------------------
// After DUI_ACT_PICK from the file browser: a folder is shown (and
// FALSE returned); a file closes the browser, and TRUE is returned
// with its path
// ----------------------------------------------------------------
{
  Text l_value = dui_popup_picked(p_ui);
  Text l_kind  = Get_subtext(l_value, 1, 2);
  Text l_path  = Get_subtext(l_value, 3, Text_length(l_value));

  if (l_kind == DUI_FILES_DIR_PREFIX) {
    dui_files_fill(p_ui, l_path);
    return FALSE;
  }
  if (l_kind == DUI_FILES_FILE_PREFIX) {
    p_path = l_path;
    dui_popup_close(p_ui);
    return TRUE;
  }
  return FALSE;
}

#endif

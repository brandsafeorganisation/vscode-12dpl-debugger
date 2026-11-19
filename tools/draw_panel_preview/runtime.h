// C++ stand-ins for the 12dPL calls the Draw UI panel uses (preview only).
// Drawing fills a pixel buffer; Wait_on_events plays back a script.
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <map>
#include <string>
#include <vector>
#include <dirent.h>
#include <sys/stat.h>
#include <unistd.h>

typedef int Integer;
typedef long long Integer64;
typedef double Real;
typedef std::string Text;

#define TRUE 1
#define FALSE 0

// ---------------------------------------------------------------- what the original panel provides
#define SUCCESS 0
#define FAILURE -1
#define DEBUG_FINISHED_FILE "debug.finished"
static Integer Shutdown_code = 424242;

// ---------------------------------------------------------------- widgets
struct Widget { Integer64 id = 0; Text title; Text data; };
typedef Widget Panel;
typedef Widget Vertical_Group;
typedef Widget Message_Box;
typedef Widget Input_Box;
typedef Widget Draw_Box;
Widget preview_new_widget(const Text &kind, const Text &title, int w = 0, int h = 0);
inline Panel Create_panel(Text t, Integer, Integer, Integer) { return preview_new_widget("panel", t); }
inline Vertical_Group Create_vertical_group(Integer) { return preview_new_widget("vgroup", ""); }
inline Message_Box Create_message_box(Text t) { return preview_new_widget("message", t); }
inline Input_Box Create_input_box(Text t, Message_Box) { return preview_new_widget("input", t); }
Draw_Box Create_draw_box(Integer w, Integer h, Integer);
inline Integer Append(Widget, Widget) { return 0; }
inline Integer Show_widget(Widget) { return 0; }
inline Integer Hide_widget(Widget) { return 0; }
inline Integer Set_focus(Widget) { return 0; }
inline Integer Set_width_in_chars(Widget, Integer) { return 0; }
inline Integer Use_browse_button(Widget, Integer) { return 0; }
inline Integer Set_sizing_constraints(Widget, Integer, Integer) { return 0; }
inline Integer Set_notify_resizing(Widget) { return 0; }
inline Integer Set_exit_code(Text) { return 0; }
Integer Set_data(Widget &w, Text t);
Integer Get_data(Widget &w, Text &t);
inline Integer64 Get_id64(const Widget &w) { return w.id; }
Integer Wait_on_events(Integer64 &id, Text &cmd, Text &msg);

// ---------------------------------------------------------------- Draw_Box
Integer Get_size(Draw_Box b, Integer &w, Integer &h);
Integer Start_batch_draw(Draw_Box);
Integer End_batch_draw(Draw_Box);
Integer Clear(Draw_Box, Integer r, Integer g, Integer b);
Integer Set_colour(Draw_Box, Integer r, Integer g, Integer b);
Integer Set_fill_colour(Draw_Box, Integer r, Integer g, Integer b);
Integer Draw_polygon(Draw_Box, Integer n, Real x[], Real y[]);
Integer Move_to(Draw_Box, Real x, Real y);
Integer Draw_to(Draw_Box, Real x, Real y);
Integer Set_text_align(Draw_Box, Integer mode);
Integer Set_text_colour(Draw_Box, Integer r, Integer g, Integer b);
inline Integer Set_text_font(Draw_Box, Text) { return 0; }
inline Integer Set_bk_mode(Draw_Box, Integer) { return 0; }
Integer Draw_text(Draw_Box, Real x, Real y, Real size, Real angle, Text t);

// ---------------------------------------------------------------- Attributes (copied by value, type checked)
struct Attr { int type; Integer i; Real r; Text t; };
struct Attributes { std::map<Text, Attr> f; };
extern int g_preview_type_errors;
inline Integer Attribute_delete_all(Attributes &a) { a.f.clear(); return 0; }
inline void preview_set(Attributes &a, const Text &n, Attr v) {
  auto it = a.f.find(n);
  if (it != a.f.end() && it->second.type != v.type) { ++g_preview_type_errors; fprintf(stderr, "[type] %s changes type\n", n.c_str()); }
  a.f[n] = v;
}
inline Integer Set_attribute(Attributes &a, Text n, Integer v) { preview_set(a, n, Attr{1, v, 0, ""}); return 0; }
inline Integer Set_attribute(Attributes &a, Text n, Real v) { preview_set(a, n, Attr{2, 0, v, ""}); return 0; }
inline Integer Set_attribute(Attributes &a, Text n, Text v) { preview_set(a, n, Attr{3, 0, 0, v}); return 0; }
inline Integer Set_attribute(Attributes &a, Text n, const char *v) { return Set_attribute(a, n, Text(v)); }
template <typename T> Integer preview_get(Attributes &a, const Text &n, int type, T &out, T Attr::*m) {
  auto it = a.f.find(n);
  if (it == a.f.end()) return 1;
  if (it->second.type != type) { ++g_preview_type_errors; fprintf(stderr, "[type] %s read as the wrong type\n", n.c_str()); return 2; }
  out = it->second.*m; return 0;
}
inline Integer Get_attribute(Attributes &a, Text n, Integer &v) { return preview_get(a, n, 1, v, &Attr::i); }
inline Integer Get_attribute(Attributes &a, Text n, Real &v) { return preview_get(a, n, 2, v, &Attr::r); }
inline Integer Get_attribute(Attributes &a, Text n, Text &v) { return preview_get(a, n, 3, v, &Attr::t); }

// ---------------------------------------------------------------- Text and maths
inline Integer Text_length(const Text &t) { return (Integer)t.size(); }
inline Text Get_subtext(const Text &t, Integer s, Integer e) {
  if (s < 1) s = 1;
  if (e > (Integer)t.size()) e = (Integer)t.size();
  if (e < s) return "";
  return t.substr(s - 1, e - s + 1);
}
inline Integer Find_text(const Text &t, const Text &f) { size_t p = t.find(f); return p == Text::npos ? 0 : (Integer)p + 1; }
inline Integer Get_char(const Text &t, Integer i, Integer &c) { if (i < 1 || i > (Integer)t.size()) return 1; c = (unsigned char)t[i - 1]; return 0; }
inline Text To_text(Integer i) { return std::to_string(i); }
inline Integer From_text(const Text &t, Real &r) { r = atof(t.c_str()); return 0; }
inline Text Text_lower(Text t) { for (auto &c : t) c = (char)tolower((unsigned char)c); return t; }
inline Text Text_justify(const Text &t) {
  size_t a = t.find_first_not_of(' '), b = t.find_last_not_of(' ');
  return a == Text::npos ? "" : t.substr(a, b - a + 1);
}
inline Real Floor(Real r) { return std::floor(r); }
inline Text Getenv(Text n) { const char *v = getenv(n.c_str()); return v ? v : ""; }

// ---------------------------------------------------------------- command line, clipboard
Integer Get_number_of_command_arguments();
Integer Get_command_argument(Integer i, Text &t);
Integer Set_clipboard_text(Text t);
Integer Get_clipboard_text(Text &t);

// ---------------------------------------------------------------- files and folders (\ becomes /)
struct Dynamic_Text { std::vector<Text> items; };
inline Integer Get_item(Dynamic_Text &d, Integer i, Text &t) { if (i < 1 || i > (Integer)d.items.size()) return 1; t = d.items[i - 1]; return 0; }
Text preview_path(Text p);
Integer File_exists(Text p);
Integer Directory_exists(Text p);
Text Get_absolute_path(Text p);
Integer List_subfolders_in_folder(Text folder, Text pattern, Integer &count, Dynamic_Text &names);
Integer List_files_in_folder(Text folder, Text pattern, Integer &count, Dynamic_Text &names);

// ---------------------------------------------------------------- the original panel's functions
Integer request_debug_build(Widget p_widget, Message_Box &p_message, Text p_source_4dm, Text &p_debug_4dm, Text &p_session_dir);
Integer panel_prompt_compile_run_a_macro(Text, Integer, Integer, Integer, Text, Integer, Integer, Integer, Integer, Integer);
Integer about_panel(Panel, Dynamic_Text, Text, Integer);

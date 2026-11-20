// Drawing, events and the stand-ins for the original panel (preview only).
#include "runtime.h"

int g_preview_type_errors = 0;

// ---------------------------------------------------------------- widgets
static Integer64 g_next_id = 100;
static std::map<Integer64, Text> g_widget_data;
static Integer64 g_box_id = 0, g_keys_id = 0, g_panel_id = 0;
static int g_w = 0, g_h = 0;

Widget preview_new_widget(const Text &kind, const Text &title, int, int) {
  Widget w; w.id = ++g_next_id; w.title = title;
  if (kind == "panel" && !g_panel_id) g_panel_id = w.id;
  if (kind == "input" && !g_keys_id) g_keys_id = w.id;
  return w;
}
Draw_Box Create_draw_box(Integer w, Integer h, Integer) {
  Widget b = preview_new_widget("box", ""); g_box_id = b.id; g_w = w; g_h = h; return b;
}
// The panel as 12d lays it out, roughly: a margin round the drawing
// and, unless collapsed, the Keys row under it. Sizes are screen pixels
// at 100% (the preview has no scaling).
static bool g_keys_collapsed = false, g_keys_visible = true;
static const int PANEL_X = 100, PANEL_Y = 100, PANEL_TITLE = 31, PANEL_MARGIN = 7, KEYS_ROW = 26;
Integer Set_collapsed(Widget w, Integer mode) { if (w.id == g_keys_id) g_keys_collapsed = mode != 0; return 0; }
Integer Set_visible(Widget w, Integer mode) { if (w.id == g_keys_id) g_keys_visible = mode != 0; return 0; }
Integer Set_size(Widget w, Integer x, Integer y) { if (w.id == g_box_id) { g_w = x; g_h = y; printf("[Set_size] drawing %d x %d\n", x, y); } return 0; }
Integer Get_widget_size(Widget w, Integer &x, Integer &y) {
  if (w.id == g_box_id) { x = g_w; y = g_h; return 0; }
  if (w.id == g_panel_id) { x = g_w + 2 * PANEL_MARGIN; y = PANEL_TITLE + g_h + 2 * PANEL_MARGIN + (g_keys_collapsed ? 0 : KEYS_ROW); return 0; }
  return 1;
}
Integer Get_widget_position(Widget w, Integer &x, Integer &y) {
  if (w.id == g_box_id) { x = PANEL_X + PANEL_MARGIN; y = PANEL_Y + PANEL_TITLE + PANEL_MARGIN; return 0; }
  if (w.id == g_panel_id) { x = PANEL_X; y = PANEL_Y; return 0; }
  return 1;
}
Integer Get_active_theme_name(Text &name) { name = Getenv("PREVIEW_12D_THEME"); if (name.empty()) name = "Light"; return 0; }

// widgets are handles in 12d: copies share their data
Integer Set_data(Widget &w, Text t) { g_widget_data[w.id] = t; return 0; }
Integer Get_data(Widget &w, Text &t) { t = g_widget_data[w.id]; return 0; }

// ---------------------------------------------------------------- drawing
// Each frame's draw calls are kept in order; snap writes them out and
// topng.py replays them (so text drawn under the popup stays under it).
struct Rgb { int r, g, b; };
static Rgb g_pen{0, 0, 0}, g_fill{0, 0, 0}, g_text_colour{0, 0, 0};
static Real g_pen_x = 0, g_pen_y = 0;
static int g_align = 0;
static std::vector<Text> g_ops;
static int g_draw_calls = 0, g_frames = 0, g_texts = 0;
static bool g_in_batch = false;

static Text rgb(Rgb c) { return std::to_string(c.r) + " " + std::to_string(c.g) + " " + std::to_string(c.b); }
static Text num(Real v) { char b[32]; snprintf(b, sizeof b, "%.2f", v); return b; }
Integer Get_size(Draw_Box, Integer &w, Integer &h) { w = g_w; h = g_h; return 0; }
Integer Start_batch_draw(Draw_Box) { g_in_batch = true; g_ops.clear(); g_draw_calls = 0; g_texts = 0; return 0; }
Integer End_batch_draw(Draw_Box) { g_in_batch = false; ++g_frames; return 0; }
static Integer need_batch() { if (!g_in_batch) { fprintf(stderr, "[draw] drawing outside a batch\n"); return 1; } ++g_draw_calls; return 0; }
Integer Clear(Draw_Box, Integer r, Integer g, Integer b) { if (need_batch()) return 1; g_ops.push_back("clear " + rgb(Rgb{r, g, b})); return 0; }
Integer Set_colour(Draw_Box, Integer r, Integer g, Integer b) { ++g_draw_calls; g_pen = Rgb{r, g, b}; return 0; }
Integer Set_fill_colour(Draw_Box, Integer r, Integer g, Integer b) { ++g_draw_calls; g_fill = Rgb{r, g, b}; return 0; }
Integer Draw_polygon(Draw_Box, Integer n, Real x[], Real y[]) {   // x and y from index 1
  if (need_batch()) return 1;
  Text op = "poly " + rgb(g_fill);
  for (int i = 1; i <= n; ++i) op += " " + num(x[i]) + " " + num(y[i]);
  g_ops.push_back(op); return 0;
}
Integer Move_to(Draw_Box, Real x, Real y) { g_pen_x = x; g_pen_y = y; return 0; }
Integer Draw_to(Draw_Box, Real x, Real y) {
  if (need_batch()) return 1;
  g_ops.push_back("line " + rgb(g_pen) + " " + num(g_pen_x) + " " + num(g_pen_y) + " " + num(x) + " " + num(y));
  g_pen_x = x; g_pen_y = y; return 0;
}
Integer Set_text_font(Draw_Box, Text font) { if (need_batch()) return 1; g_ops.push_back("font 0 0 0\t" + font); return 0; }
Integer Set_text_align(Draw_Box, Integer m) { ++g_draw_calls; g_align = m; return 0; }
Integer Set_text_colour(Draw_Box, Integer r, Integer g, Integer b) { ++g_draw_calls; g_text_colour = Rgb{r, g, b}; return 0; }
Integer Draw_text(Draw_Box, Real x, Real y, Real size, Real, Text t) {
  if (need_batch()) return 1;
  ++g_texts;
  g_ops.push_back("text " + rgb(g_text_colour) + " " + num(x) + " " + num(y) + " " + num(size) + " " + std::to_string(g_align) + "\t" + t);
  return 0;
}

static void snap(const Text &name) {
  std::ofstream f(Getenv("PREVIEW_OUT") + "/" + name + ".draw");
  f << g_w << " " << g_h << "\n";
  for (auto &op : g_ops) f << op << "\n";
  printf("[snap] %s  frame %d, %d draw calls, %d texts, type errors %d\n", name.c_str(), g_frames, g_draw_calls, g_texts, g_preview_type_errors);
}

// ---------------------------------------------------------------- command line, clipboard
static std::vector<Text> g_args;
static Text g_clipboard;
Integer Get_number_of_command_arguments() { return (Integer)g_args.size(); }
Integer Get_command_argument(Integer i, Text &t) { if (i < 1 || i > (Integer)g_args.size()) return 1; t = g_args[i - 1]; return 0; }
Integer Set_clipboard_text(Text t) { g_clipboard = t; return 0; }
Integer Get_clipboard_text(Text &t) { t = g_clipboard; return 0; }

// ---------------------------------------------------------------- files
Text preview_path(Text p) { std::replace(p.begin(), p.end(), '\\', '/'); return p; }
Integer File_exists(Text p) { struct stat s; return stat(preview_path(p).c_str(), &s) == 0 && S_ISREG(s.st_mode); }
Integer Directory_exists(Text p) { struct stat s; return stat(preview_path(p).c_str(), &s) == 0 && S_ISDIR(s.st_mode); }
Text Get_absolute_path(Text p) {
  if (!p.empty() && (p[0] == '/' || p[0] == '\\')) return p;
  char buf[4096]; if (!getcwd(buf, sizeof buf)) return p;
  return p == "." ? Text(buf) : Text(buf) + "/" + p;
}
static bool matches(const Text &name, const Text &pattern) {
  if (pattern == "*") return true;
  if (pattern.size() > 1 && pattern[0] == '*') { Text end = pattern.substr(1); return name.size() >= end.size() && name.compare(name.size() - end.size(), end.size(), end) == 0; }
  return name == pattern;
}
static Integer list(Text folder, Text pattern, bool dirs, Integer &count, Dynamic_Text &names) {
  names.items.clear();
  DIR *d = opendir(preview_path(folder).c_str()); if (!d) return 1;
  while (dirent *e = readdir(d)) {
    Text n = e->d_name; if (n == "." || n == "..") continue;
    if ((bool)Directory_exists(folder + "/" + n) != dirs || !matches(n, pattern)) continue;
    names.items.push_back(n);
  }
  closedir(d); std::sort(names.items.begin(), names.items.end());
  count = (Integer)names.items.size(); return 0;
}
Integer List_subfolders_in_folder(Text f, Text p, Integer &c, Dynamic_Text &n) { return list(f, p, true, c, n); }
Integer List_files_in_folder(Text f, Text p, Integer &c, Dynamic_Text &n) { return list(f, p, false, c, n); }

// ---------------------------------------------------------------- the original panel's work, stood in
// PREVIEW_VSCODE=ok makes VS Code "answer"; otherwise it doesn't
Integer request_debug_build(Widget, Message_Box &p_message, Text p_source_4dm, Text &p_debug_4dm, Text &p_session_dir) {
  printf("[request_debug_build] %s\n", p_source_4dm.c_str());
  if (Getenv("PREVIEW_VSCODE") == "ok") {
    p_session_dir = "C:\\work\\.12dpl-debug\\session";
    p_debug_4dm = p_session_dir + "\\" + p_source_4dm.substr(p_source_4dm.find_last_of("/\\") + 1);
    Set_data(p_message, "Debugging"); return SUCCESS;
  }
  Set_data(p_message, "VS Code did not answer. Is the 12dPL Debugger extension installed?");
  return FAILURE;
}
Integer panel_prompt_compile_run_a_macro(Text f, Integer a, Integer b, Integer c, Text args, Integer d, Integer e, Integer g, Integer h, Integer k) {
  printf("[Compile/Run a Macro] %s  old_string=%d old_id=%d keep_cpp=%d args=\"%s\" buttons=%d console=%d retain=%d defaults=%d keep_open=%d\n",
         f.c_str(), a, b, c, args.c_str(), d, e, g, h, k);
  return 0;
}
Integer about_panel(Panel, Dynamic_Text, Text, Integer) { printf("[about_panel]\n"); return 0; }

// ---------------------------------------------------------------- the script
// Coordinates are from the TOP left of the box (as in a screenshot).
//   move x y | down x y | click x y | dclick x y | leave
//   key <char> | key bs|ctrlbs|esc|tab|enter|paste|copy | type <text>
//   clip <text>     put text on the clipboard
//   resize w h      resize the box (Panel_Resize)
//   snap <name>     save the box as out/<name>.ppm (+ .txt for the text)
//   about | quit
static std::vector<Text> g_script; static size_t g_line = 0; static Text g_typing; static size_t g_typed = 0;
void preview_load(const char *path, int argc, char **argv) {
  std::ifstream f(path); Text l;
  while (std::getline(f, l)) { if (!l.empty() && l.back() == '\r') l.pop_back(); if (!l.empty() && l[0] != '#') g_script.push_back(l); }
  for (int i = 0; i < argc; ++i) g_args.push_back(argv[i]);
}
static Text xy(const Text &rest) { Real x = 0, y = 0; sscanf(rest.c_str(), "%lf %lf", &x, &y); return std::to_string(x) + " " + std::to_string(g_h - y); }
Integer Wait_on_events(Integer64 &id, Text &cmd, Text &msg) {
  if (g_typed < g_typing.size()) { id = g_keys_id; cmd = "keystroke"; msg = Text(1, g_typing[g_typed++]); return 0; }
  while (g_line < g_script.size()) {
    Text l = g_script[g_line++]; Text op = l.substr(0, l.find(' ')); Text rest = l.size() > op.size() ? l.substr(op.size() + 1) : "";
    if (op == "snap") { snap(rest); continue; }
    if (op == "clip") { g_clipboard = rest; continue; }
    if (op == "move")   { id = g_box_id; cmd = "mouse_move"; msg = xy(rest); return 0; }
    if (op == "down")   { id = g_box_id; cmd = "click_lb_down"; msg = xy(rest); return 0; }
    if (op == "click")  { g_script.insert(g_script.begin() + g_line, "up " + rest); id = g_box_id; cmd = "click_lb_down"; msg = xy(rest); return 0; }
    if (op == "up")     { id = g_box_id; cmd = "click_lb"; msg = xy(rest); return 0; }
    if (op == "dclick") { id = g_box_id; cmd = "double_click_lb"; msg = xy(rest); return 0; }
    if (op == "leave")  { id = g_box_id; cmd = "mouse_leave"; msg = ""; return 0; }
    if (op == "type")   { g_typing = rest; g_typed = 0; return Wait_on_events(id, cmd, msg); }
    if (op == "key") {
      id = g_keys_id; cmd = "keystroke"; int c = rest.empty() ? ' ' : rest[0];
      if (rest == "bs") c = 8; if (rest == "ctrlbs") c = 127; if (rest == "esc") c = 27; if (rest == "tab") c = 9;
      if (rest == "enter") c = 13; if (rest == "paste") c = 22; if (rest == "copy") c = 3; if (rest == "space") c = ' ';
      msg = Text(1, (char)c); return 0;
    }
    if (op == "resize") { sscanf(rest.c_str(), "%d %d", &g_w, &g_h); id = g_panel_id; cmd = "Panel_Resize"; msg = ""; return 0; }
    if (op == "about")  { id = g_panel_id; cmd = "Panel About"; msg = ""; return 0; }
    if (op == "quit")   break;
    printf("[script] unknown line: %s\n", l.c_str());
  }
  id = g_panel_id; cmd = "Panel Quit"; msg = ""; return 0;
}

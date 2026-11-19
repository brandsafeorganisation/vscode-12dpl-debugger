#ifndef DEBUG_DRAW_PANEL_H_INCLUDED
#define DEBUG_DRAW_PANEL_H_INCLUDED

// ----------------------------------------------------------------
// The Compile/Debug a Macro panel, drawn in a Draw_Box
// ----------------------------------------------------------------

#define DDP_TITLE             ("Compile/Debug a Macro")
#define DDP_KEYS_TITLE        ("Keys")
#define DDP_VIEW_WIDTH        379     // same width as the original panel
#define DDP_VIEW_HEIGHT       374
#define DDP_SOURCE_PATTERN    ("*.4dm")

// ---------------------------------------------------------------- widget ids
#define DDP_W_COMPILE_GROUP       1
#define DDP_W_SOURCE_LABEL        2
#define DDP_W_MACRO_SOURCE        3
#define DDP_W_BROWSE_SOURCE       4
#define DDP_W_ALLOW_OLD_STRING    5
#define DDP_W_ALLOW_OLD_ID        6
#define DDP_W_KEEP_CPP            7
#define DDP_W_ARGUMENTS_GROUP     8
#define DDP_W_MACRO_ARGUMENTS     9
#define DDP_W_RUN_GROUP          10
#define DDP_W_SHOW_BUTTONS       11
#define DDP_W_SHOW_CONSOLE       12
#define DDP_W_RETAIN_ON_EXIT     13
#define DDP_W_ALLOW_DEFAULTS     14
#define DDP_W_KEEP_GROUP         15
#define DDP_W_KEEP_PANEL_OPEN    16
#define DDP_W_MESSAGE            17
#define DDP_W_COMPILE_DEBUG      18
#define DDP_W_FINISH             19
#define DDP_W_HELP               20

// ---------------------------------------------------------------- defaults (as in 12d's Compile/Run a Macro)
#define DEFAULT_ALLOW_OLD_STRING  0
#define DEFAULT_ALLOW_OLD_ID      0
#define DEFAULT_KEEP_CPP          0
#define DEFAULT_SHOW_BUTTONS      0
#define DEFAULT_SHOW_CONSOLE      0
#define DEFAULT_RETAIN_ON_EXIT    0
#define DEFAULT_ALLOW_DEFAULTS    0
#define DEFAULT_KEEP_PANEL_OPEN   1

// ---------------------------------------------------------------- debug_draw_panel.4dm
void    ddp_defaults       (Attributes &p_ui);
void    ddp_layout         (Attributes &p_ui, Real p_w, Real p_h);
void    ddp_frame          (Draw_Box p_box, Attributes &p_ui, Attributes &p_theme);
void    ddp_help_open      (Attributes &p_ui);
void    ddp_browse_open    (Attributes &p_ui);
Integer ddp_compile_debug  (Panel p_panel, Draw_Box p_box, Message_Box p_message, Attributes &p_ui, Attributes &p_theme, Text &p_last_session_dir);
Integer show_draw_panel    (Integer p_theme_kind);

#endif

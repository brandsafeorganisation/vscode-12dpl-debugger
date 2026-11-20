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

// ---------------------------------------------------------------- command line (besides the theme and font)
#define DDP_ARG_FILL          ("fill")    // no gaps round the drawing inside its vertical group
#define DDP_ARG_GROW          ("grow=")   // grow=<pixels>: make the drawing that much wider and taller once shown
#define DDP_ARG_KEYS          ("keys")    // show the Keys box (it is hidden otherwise)

// ---------------------------------------------------------------- what Help shows about the panel's size
#define DDP_ATTR_SIZE_PANEL   ("ddp_size_panel")
#define DDP_ATTR_SIZE_BOX     ("ddp_size_box")
#define DDP_ATTR_SIZE_THEME   ("ddp_size_theme")

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
void    ddp_layout         (Attributes &p_ui, Attributes &p_theme, Real p_w, Real p_h);
void    ddp_frame          (Draw_Box p_box, Attributes &p_ui, Attributes &p_theme);
void    ddp_help_open      (Attributes &p_ui, Attributes &p_theme);
void    ddp_browse_open    (Attributes &p_ui);
Integer ddp_compile_debug  (Panel p_panel, Draw_Box p_box, Message_Box p_message, Attributes &p_ui, Attributes &p_theme, Text &p_last_session_dir);
void    ddp_measure        (Panel p_panel, Draw_Box p_box, Attributes &p_ui);
Integer show_draw_panel    (Attributes &p_theme, Integer p_fill, Integer p_grow, Integer p_show_keys);

#endif

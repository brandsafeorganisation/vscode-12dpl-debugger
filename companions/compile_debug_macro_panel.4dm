// --------------------------------------------------------
// Macro: Compile/Debug Panel
// Author: George Gunter
// Organization: Me
// Date: 08/11/2026
// --------------------------------------------------------
//
// Compile/Debug a Macro
//
// 1. Pick the macro source (the .4dm with main) and the usual Compile/Run
//    settings.
// 2. Compile/Debug asks VS Code (through the 12dPL Debugger extension) to
//    open the macro and start a debug session. The extension writes the
//    instrumented copy and answers with its path.
// 3. The 12d Compile/Run option is then run on the instrumented copy, with
//    the settings from this panel.
//
// Handshake with the extension:
//   this macro writes the source path to   %TEMP%\12dpl_debug_request.txt
//     (followed by 12d's include search: CPATH, SET_UPS_4D, USER_4D,
//      LIB_4D and USER_LIB_4D, one NAME=value per line, so the extension
//      finds includes the way the 12d compiler does)
//   then opens                             vscode://georgegunter.12dpl-debugger/debug?request=<that file>
//   the extension answers in               %TEMP%\12dpl_debug_request.txt.reply
//     line 1: ok | error
//     line 2: instrumented entry file      (or the error message)
//     line 3: session folder
// --------------------------------------------------------

{
  Integer Shutdown_code = 424242;
}

// Calls cc4d.exe directly so you need your CPATH set up and then it wasn't working anyway think I got the separators working
// #include <set_ups.h>

#define DEBUGGER_URI            "vscode://georgegunter.12dpl-debugger/debug?request="
#define REQUEST_FILE_NAME       "12dpl_debug_request.txt"
#define REPLY_TIMEOUT_MS        60000
#define REPLY_POLL_MS           200
#define VSCODE_SLOW_MS          5000    // say "waiting for VS Code to start" after this
#define SW_SHOWNORMAL           1

#define SUCCESS                 0
#define FAILURE                 -1


Text char_to_text(Integer p_char)
// ----------------------------------------------------------------
//  One character as a Text
// ----------------------------------------------------------------
{
  Text l_text = " ";
  Set_char(l_text, 1, p_char);
  return l_text;
}

Text xml_escape(Text p_text)
// ----------------------------------------------------------------
//  Escape a value for the SLX data given to Panel_prompt
// ----------------------------------------------------------------
{
  Text    l_out    = "";
  Integer l_length = Text_length(p_text);
  for (Integer i = 1; i <= l_length; i++) {
    Integer l_char = 0;
    Get_char(p_text, i, l_char);
    switch (l_char) {
      case '&' : {
        l_out += "&amp;";
      } break;
      case '<' : {
        l_out += "&lt;";
      } break;
      case '>' : {
        l_out += "&gt;";
      } break;
      case '"' : {
        l_out += "&quot;";
      } break;
      default : {
        l_out += char_to_text(l_char);
      }
    }
  }
  return l_out;
}

Text url_encode(Text p_text)
// ----------------------------------------------------------------
//  Percent-encode the characters that would break the vscode:// link
// ----------------------------------------------------------------
{
  Text    l_out    = "";
  Integer l_length = Text_length(p_text);
  for (Integer i = 1; i <= l_length; i++) {
    Integer l_char = 0;
    Get_char(p_text, i, l_char);
    switch (l_char) {
      case '%' : {
        l_out += "%25";
      } break;
      case ' ' : {
        l_out += "%20";
      } break;
      case '#' : {
        l_out += "%23";
      } break;
      case '&' : {
        l_out += "%26";
      } break;
      case '+' : {
        l_out += "%2B";
      } break;
      case '?' : {
        l_out += "%3F";
      } break;
      default : {
        l_out += char_to_text(l_char);
      }
    }
  }
  return l_out;
}

Text slx_tick_box(Text p_name, Integer p_value)
// ----------------------------------------------------------------
{
  Text l_value = "false";
  if (p_value != 0) {
    l_value = "true";
  }
  return "<tick_box><name>" + xml_escape(p_name) + "</name><value>" + l_value + "</value></tick_box>";
}

Integer panel_prompt_compile_run_a_macro(
  Text    filepath_debug_4dm,
  Integer allow_old_string_calls,
  Integer allow_old_id_calls,
  Integer keep_cpp_file,
  Text    macro_arguments,
  Integer show_buttons,
  Integer show_console,
  Integer retain_on_exit,
  Integer allow_defaults,
  Integer keep_panel_open
)
// ----------------------------------------------------------------
//  Run 12d's Compile/Run a Macro option with the given settings
// ----------------------------------------------------------------
{
  Text    panel_name  = "Compile/Run a Macro";
  Integer interactive = 0xff00;
  Text    panel_data  = "";

  panel_data += "<file_box>";
  panel_data +=   "<name>Macro source</name>";
  panel_data +=   "<value>" + xml_escape(filepath_debug_4dm) + "</value>";
  panel_data += "</file_box>";
  panel_data += slx_tick_box("Allow old string calls", allow_old_string_calls);
  panel_data += slx_tick_box("Allow old id calls"    , allow_old_id_calls);
  panel_data += slx_tick_box("Keep cpp file"         , keep_cpp_file);
  panel_data += "<input_box>";
  panel_data +=   "<name>Macro Arguments</name>";
  panel_data +=   "<value>" + xml_escape(macro_arguments) + "</value>";
  panel_data += "</input_box>";
  panel_data += slx_tick_box("Show buttons"             , show_buttons);
  panel_data += slx_tick_box("Show console"             , show_console);
  panel_data += slx_tick_box("Retain on exit"           , retain_on_exit);
  panel_data += slx_tick_box("Allow defaults"           , allow_defaults);
  panel_data += slx_tick_box("Keep panel open after run", keep_panel_open);
  panel_data += "<run_button>";
  panel_data +=   "<name>&amp;Compile/Run</name>";
  panel_data += "</run_button>";

  return Panel_prompt(panel_name, interactive, panel_data);
}

Integer read_reply(Text p_reply_file, Text &p_status, Text &p_line_2, Text &p_line_3)
// ----------------------------------------------------------------
{
  File l_file;
  if (File_open(p_reply_file, "r", "ccs=UTF-8", l_file) != 0) {
    return FAILURE;
  }
  p_status = "";
  p_line_2 = "";
  p_line_3 = "";
  File_read_line(l_file, p_status);
  File_read_line(l_file, p_line_2);
  File_read_line(l_file, p_line_3);
  File_close(l_file);
  return SUCCESS;
}

Integer start_code_exe(Widget p_widget, Text p_code_exe, Text p_uri)
// ----------------------------------------------------------------
//  Start VS Code at p_code_exe with p_uri, as Windows does for a
//  vscode:// link. Returns SUCCESS if it was started.
// ----------------------------------------------------------------
{
  if (File_exists(p_code_exe) == 0) {
    return FAILURE;
  }
  if (Shell_execute(p_widget, "open", p_code_exe, "--open-url -- \"" + p_uri + "\"", "", SW_SHOWNORMAL) != 0) {
    return FAILURE;
  }
  return SUCCESS;
}

Integer open_vscode(Widget p_widget, Text p_uri)
// ----------------------------------------------------------------
//  Hand p_uri to VS Code, starting VS Code if it isn't open.
//  Opening the vscode:// link does both when VS Code registered the
//  link with Windows (its installer does). If that fails, start Code.exe
//  from where the installers put it.
// ----------------------------------------------------------------
{
  if (Shell_execute(p_widget, "open", p_uri, "", "", SW_SHOWNORMAL) == 0) {
    return SUCCESS;
  }
  // User install
  if (start_code_exe(p_widget, Getenv("LOCALAPPDATA") + "\\Programs\\Microsoft VS Code\\Code.exe", p_uri) == SUCCESS) {
    return SUCCESS;
  }
  // System install
  if (start_code_exe(p_widget, "C:\\Program Files\\Microsoft VS Code\\Code.exe", p_uri) == SUCCESS) {
    return SUCCESS;
  }
  return FAILURE;
}

Integer request_debug_build(
  Widget      p_widget,
  Message_Box p_message,
  Text        p_source_4dm,
  Text        &p_debug_4dm,
  Text        &p_session_dir
)
// ----------------------------------------------------------------
//  Ask the VS Code extension to start debugging p_source_4dm.
//  Returns SUCCESS with the instrumented file and its session folder,
//  or FAILURE with the reason shown in p_message.
// ----------------------------------------------------------------
{
  Text l_temp_dir = "";
  Get_temporary_directory(l_temp_dir);
  Text l_request = l_temp_dir + "\\" + REQUEST_FILE_NAME;
  Text l_reply   = l_request + ".reply";
  File_delete(l_reply);

  File l_file;
  if (File_open(l_request, "w", "ccs=UTF-8", l_file) != 0) {
    Set_data(p_message, "Could not write " + l_request);
    return FAILURE;
  }
  File_write_line(l_file, p_source_4dm);
  File_write_line(l_file, "CPATH="       + Getenv("CPATH"));
  File_write_line(l_file, "SET_UPS_4D="  + Getenv("SET_UPS_4D"));
  File_write_line(l_file, "USER_4D="     + Getenv("USER_4D"));
  File_write_line(l_file, "LIB_4D="      + Getenv("LIB_4D"));
  File_write_line(l_file, "USER_LIB_4D=" + Getenv("USER_LIB_4D"));
  File_close(l_file);

  Set_data(p_message, "Starting the debugger in VS Code...");
  if (open_vscode(p_widget, DEBUGGER_URI + url_encode(l_request)) != SUCCESS) {
    Set_data(p_message, "Could not start VS Code. Is it installed?");
    return FAILURE;
  }

  Integer l_waited = 0;
  while (File_exists(l_reply) == 0) {
    if (l_waited >= REPLY_TIMEOUT_MS) {
      Set_data(p_message, "VS Code did not answer. Is the 12dPL Debugger extension installed?");
      return FAILURE;
    }
    if (l_waited == VSCODE_SLOW_MS) {
      Set_data(p_message, "Waiting for VS Code to start...");
    }
    Sleep(REPLY_POLL_MS);
    l_waited += REPLY_POLL_MS;
  }

  Text l_status = "", l_line_2 = "", l_line_3 = "";
  if (read_reply(l_reply, l_status, l_line_2, l_line_3) != SUCCESS) {
    Set_data(p_message, "Could not read " + l_reply);
    return FAILURE;
  }
  File_delete(l_reply);
  File_delete(l_request);

  if (l_status != "ok") {
    Set_data(p_message, l_line_2);
    return FAILURE;
  }
  p_debug_4dm   = l_line_2;
  p_session_dir = l_line_3;
  return SUCCESS;
}

Integer set_panel_width(Panel &panel, Real new_width)
// --------------------------------------------------
  // Set a new width of the panel
// --------------------------------------------------
{
  Integer redraw = 1;
  Integer panel_width = 300, panel_height = 300;
  Integer ierr = Get_widget_size(panel, panel_width, panel_height);

  return Set_window_size(panel, new_width, panel_height, redraw);
}

Integer show_panel()
{
  // Panel essentials
  Panel          panel       = Create_panel         ("Compile/Debug a Macro", 1, 1, 1);
  Vertical_Group vgroup      = Create_vertical_group(-1);
  Message_Box    message     = Create_message_box   ("");


  Vertical_Group vg_compile_options     = Create_vertical_group(-1);
  Vertical_Group vg_macro_arguments     = Create_vertical_group(-1);
  Vertical_Group vg_run_parameters_col1 = Create_vertical_group(-1);
  Vertical_Group vg_run_parameters_col2 = Create_vertical_group(-1);
  Vertical_Group vg_keep_panel_open     = Create_vertical_group(-1);

  Horizontal_Group hg_run_parameters = Create_horizontal_group(-1);

  // Inputs
  File_Box  fb_macro_source    = Create_file_box ("Macro source", message, 1 /*CHECK_FILE_MUST_EXIST*/, "*.4dm");
  Input_Box ib_macro_arguments = Create_input_box(""            , message);

  // Compile/Run settings (defaults as in 12d's Compile/Run a Macro)
  Named_Tick_Box tb_allow_old_string_calls = Create_named_tick_box("Allow old string calls"   , 0, "AllowOldStringCalls");
  Named_Tick_Box tb_allow_old_id_calls     = Create_named_tick_box("Allow old id calls"       , 0, "AllowOldIdCalls");
  Named_Tick_Box tb_keep_cpp_file          = Create_named_tick_box("Keep cpp file"            , 0, "KeepCppFile");
  Named_Tick_Box tb_show_buttons           = Create_named_tick_box("Show buttons"             , 0, "ShowButtons");
  Named_Tick_Box tb_show_console           = Create_named_tick_box("Show console"             , 0, "ShowConsole");
  Named_Tick_Box tb_retain_on_exit         = Create_named_tick_box("Retain on exit"           , 0, "RetainOnExit");
  Named_Tick_Box tb_allow_defaults         = Create_named_tick_box("Allow defaults"           , 0, "AllowDefaults");
  Named_Tick_Box tb_keep_panel_open        = Create_named_tick_box("Keep panel open after run", 1, "KeepPanelOpen");

  // Add buttons along bottom
  Horizontal_Group bgroup = Create_button_group();
  Button bn_compile_debug = Create_button       ("&Compile/Debug", "CompileDebug");
  Button bn_finish        = Create_finish_button("&Finish"       , "Finish");
  Button bn_help          = Create_help_button  (panel           , "&Help");


  Set_border(vg_compile_options, "Compile Options");
  Set_border(vg_macro_arguments, "Macro Arguments");
  Set_border(hg_run_parameters , "Run Parameters" );
  Set_border(vg_keep_panel_open, "-"              );

  Use_browse_button(ib_macro_arguments, 0 /*FALSE*/);

  // Panel layout
  Append(vgroup, panel);
  {
    Append(vg_compile_options, vgroup);
    {
      Append(fb_macro_source          , vg_compile_options);
      Append(tb_allow_old_string_calls, vg_compile_options);
      Append(tb_allow_old_id_calls    , vg_compile_options);
      Append(tb_keep_cpp_file         , vg_compile_options);
    }
    Append(vg_macro_arguments, vgroup);
    {
      Append(ib_macro_arguments, vg_macro_arguments);
    }
    Append(hg_run_parameters, vgroup);
    {
      Append(vg_run_parameters_col1, hg_run_parameters);
      {
        Append(tb_show_buttons   , vg_run_parameters_col1);
        Append(tb_show_console   , vg_run_parameters_col1);
      }
      Append(vg_run_parameters_col2, hg_run_parameters);
      {
        Append(tb_retain_on_exit , vg_run_parameters_col2);
        Append(tb_allow_defaults , vg_run_parameters_col2);
      }
    }
    Append(vg_keep_panel_open, vgroup);
    {
      Append(tb_keep_panel_open, vg_keep_panel_open);
    }
    Append(message, vgroup);
    Append(bgroup, vgroup);
    {
      Append(bn_compile_debug, bgroup);
      Append(bn_finish       , bgroup);
      Append(bn_help         , bgroup);
    }
  }

  Show_widget(panel);
  set_panel_width(panel, 379); // Same width as OG

  Integer doit = 1;
  Integer shutdown = 0;

  // Session folder of the last debug build started from here; while its
  // macro.lock exists that build is still running.
  Text last_session_dir = "";

  while(doit) {
    Integer64 id = 0LL;
    Text cmd = "", msg = "";
    Integer ret = Wait_on_events(id, cmd, msg);

    switch (cmd) {
      // case "keystroke" : forgot
      // case "keystroke" :
      case "keystroke" : {
        continue;
      } break;

      case "CodeShutdown" : {
        Set_exit_code("CodeShutdown");
        shutdown = Shutdown_code;
        doit = 0;
      }
    }

    switch(id) {

      case Get_id64(panel) : {

        if(cmd == "Panel Quit") {
          doit = 0;
        }

        break;
      }

      case Get_id64(bn_compile_debug) : {

        if(cmd != "CompileDebug") {
          break;
        }

        // One debug run at a time: the debugger can only follow one copy.
        if (last_session_dir != "") {
          if (File_exists(last_session_dir + "\\macro.lock") != 0) {
            Set_data(message, "The last debug build is still running. Finish it, or stop debugging in VS Code.");
            break;
          }
        }

        Text    filepath_4dm           = "";
        Integer allow_old_string_calls = 0 /*FALSE*/;
        Integer allow_old_id_calls     = 0 /*FALSE*/;
        Integer keep_cpp_file          = 0 /*FALSE*/;
        Integer show_buttons           = 0 /*FALSE*/;
        Integer show_console           = 0 /*FALSE*/;
        Integer retain_on_exit         = 0 /*FALSE*/;
        Integer allow_defaults         = 0 /*FALSE*/;
        Integer keep_panel_open        = 1 /*TRUE*/;
        Text    macro_arguments        = "";

        { // Compile options

          { // Macro source
            Integer ierr = Validate(fb_macro_source, 17 /*GET_FILE_MUST_EXIST*/, filepath_4dm);
            if (ierr != 5 /*FILE_EXISTS*/) {
              Set_error_message(fb_macro_source, "File must exist");
              break;
            }

            // Lazy hack?
            Text directory_4dm = "";
            Get_directory(fb_macro_source, directory_4dm);

            // Remove trailing .
            directory_4dm = Get_subtext(directory_4dm, 0, Text_length(directory_4dm) - 1);
            filepath_4dm = Get_absolute_path(directory_4dm + filepath_4dm);
          }

          { // Allow old string calls
            Integer ierr = Validate(tb_allow_old_string_calls, allow_old_string_calls);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - Allow old string calls");
              break;
            }
          }

          { // Allow old id calls
            Integer ierr = Validate(tb_allow_old_id_calls, allow_old_id_calls);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - Allow old id calls");
              break;
            }
          }

          { // Keep cpp file
            Integer ierr = Validate(tb_keep_cpp_file, keep_cpp_file);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - keep cpp file");
              break;
            }
          }

        }

        { // Macro Arguments
          Get_data(ib_macro_arguments, macro_arguments);
          // Integer ierr = Validate(ib_macro_arguments, macro_arguments);
        }

        { // Run Parameters

          { // Show buttons
            Integer ierr = Validate(tb_show_buttons, show_buttons);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - Show buttons");
              break;
            }
          }

          { // Show console
            Integer ierr = Validate(tb_show_console, show_console);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - Show console");
              break;
            }
          }

          { // Retain on exit
            Integer ierr = Validate(tb_retain_on_exit, retain_on_exit);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - Retain on exit");
              break;
            }
          }

          { // Allow defaults
            Integer ierr = Validate(tb_allow_defaults, allow_defaults);
            if (ierr != 1 /*TRUE*/) {
              Set_data(message, "Error - allow defaults");
              break;
            }
          }

        }

        { // Keep panel open after run
          Integer ierr = Validate(tb_keep_panel_open, keep_panel_open);
          if (ierr != 1 /*TRUE*/) {
            Set_data(message, "Error - Keep panel open after run");
            break;
          }
        }




        Text filepath_debug_4dm = "";
        Text session_dir        = "";
        if (request_debug_build(panel, message, filepath_4dm, filepath_debug_4dm, session_dir) != SUCCESS) {
          break;
        }
        last_session_dir = session_dir;
        Set_data(message, "Debugging " + filepath_debug_4dm);

        Integer prompt_ret = panel_prompt_compile_run_a_macro(
          filepath_debug_4dm,
          allow_old_string_calls, allow_old_id_calls, keep_cpp_file,
          macro_arguments,
          show_buttons, show_console, retain_on_exit, allow_defaults, keep_panel_open
        );
        if (prompt_ret != 0) {
          Set_data(message, "Compile/Run a Macro failed (" + To_text(prompt_ret) + ")");
        }
        break;
      }

      case Get_id64(bn_finish) : {

        if(cmd != "Finish") {
          continue;
        }

        doit = 0;

        break;
      }
    }
  }

  if(shutdown != 0) {

    // only do what is absolutely critical - if anything at all
    return shutdown;
  }

  return 0;
}

void main()
{
  Integer shutdown = show_panel();
  if(shutdown == Shutdown_code) {

    // get out real fast
    return;
  }

  // we can do normal exit
  return;
}

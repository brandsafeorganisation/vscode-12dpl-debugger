// --------------------------------------------------------
// Macro:
// Author: Mark
// Organization: Demo - Mark Man
// Date: 09/07/2022
// --------------------------------------------------------

{
  Integer Shutdown_code = 424242;
}

#include <set_ups.h>

Integer panel_prompt_compile_run_a_macro(Text filepath_debug_4dm)
{
  Text    panel_name  = "Compile/Run a Macro";
  Integer interactive = 0xff00;
  Text    panel_data  = "";

  // @TODO move out all settings to variables
  panel_data += "<file_box>";
  panel_data +=   "<name>Macro source</name>";
  panel_data +=   "<value>" + filepath_debug_4dm + "</value>";
  panel_data += "</file_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Allow old string calls</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Allow old id calls</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Keep cpp file</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<input_box>";
  panel_data +=   "<name>Macro Arguments</name>";
  panel_data += "<value/>";
  panel_data += "</input_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Show buttons</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Show console</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Retain on exit</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Allow defaults</name>";
  panel_data +=   "<value>false</value>";
  panel_data += "</tick_box>";
  panel_data += "<tick_box>";
  panel_data +=   "<name>Keep panel open after run</name>";
  panel_data +=   "<value>true</value>";
  panel_data += "</tick_box>";
  panel_data += "<run_button>";
  panel_data +=   "<name>&amp;Compile/Run</name>";
  panel_data += "</run_button>";

  return Panel_prompt(panel_name, interactive, panel_data);
}

Integer show_panel()
{
  // Panel essentials
  Panel          panel       = Create_panel         ("Compile/Debug a Macro", 1, 1, 1);
  Vertical_Group vgroup      = Create_vertical_group(-1);
  Message_Box    message     = Create_message_box   ("");


  Vertical_Group vg_compile_options = Create_vertical_group(-1);
  Vertical_Group vg_macro_arguments = Create_vertical_group(-1);

  // Inputs
  File_Box  fb_macro_source    = Create_file_box ("Macro source", message, CHECK_FILE_MUST_EXIST, "*.4dm");
  Input_Box ib_macro_arguments = Create_input_box(""            , message);

  // Add buttons along bottom
  Horizontal_Group bgroup = Create_button_group();
  Button bn_compile_debug = Create_button       ("&Compile/Debug", "CompileDebug");
  Button bn_finish        = Create_finish_button("&Finish"       , "Finish");
  Button bn_help          = Create_help_button  (panel           , "&Help");


  Set_border(vg_compile_options, "Compile Options");
  Set_border(vg_macro_arguments, "Macro Arguments");

  Use_browse_button(ib_macro_arguments, FALSE);

  // Panel layout
  Append(vgroup, panel);
  {
    Append(vg_compile_options, vgroup);
    {
      Append(fb_macro_source, vg_compile_options);
    }
    Append(vg_macro_arguments, vgroup);
    {
      Append(ib_macro_arguments, vg_macro_arguments);
    }
    Append(bgroup, vgroup);
    {
      Append(bn_compile_debug, bgroup);
      Append(bn_finish       , bgroup);
      Append(bn_help         , bgroup);
    }
    Append(message, vgroup);
  }

  Show_widget(panel);

  Integer doit = 1;
  Integer shutdown = 0;

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


        Text filepath_4dm = "";
        {
          Integer ierr = Validate(fb_macro_source, GET_FILE_MUST_EXIST, filepath_4dm);
          if (ierr != FILE_EXISTS) {
            Set_error_message(fb_macro_source, "File must exist");
            break;
          }
        }

        // Process_Handle ?
        // open_vs_code(filepath_4dm); ?
        // wait_for_extension(); ?

        Text filepath_debug_4dm = "";
        // get_debug_4dm_file_path(filepath_debug_4dm) ?

        panel_prompt_compile_run_a_macro(filepath_debug_4dm);
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
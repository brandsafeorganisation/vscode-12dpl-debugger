## Naming

| Category                                          | Naming Convention              |
| ------------------------------------------------- | ------------------------------ |
| Global variable                                   | g_*                            |
| Function parameter                                | p_*                            |
| Local variable                                    | l_*                            |
| Functions and variables                           | Lower case, snake case         |
| Functions                                         | Unabbreviated                  |
| Variables                                         | Meaningful, hungarian notation |
| Pre-processor macros                              | Upper case                     |
| Pre-processor macros that represent flags         | Title case                     |
| Generic object-like pre-processor macro arguments | `I01`, `I02`, etc              |


## Project Structure

### Folders

Folders can be created within these folders, if it would make it more organised.

| Folder    | Content                                          |
| --------- | ------------------------------------------------ |
| `src`     | Project-specific `4dm` files                     |
| `include` | Project-specific header (`h`) files              |
| `libs`    | Non-project specific files (typically `h` files) |
| `test`    | Unit tests, data, separate build                 |

## Standard Code Structure

The following assumes the macro is a panel.
### Base File

This is the `4dm` file that will be compiled into the `4do`. It should only have the comment, the include path to `build.4dm`, and the `main` function.

```
//------------------------------------------------------------
// Macro: my_macro.4do
// Date: dd/mm/yyyy
// Programmer:
//
// Brief description:
//
// Description:
//  ...
//
//------------------------------------------------------------



#ifdef <macro name>_BASE_FILE_4DM_INCLUDED
#error Do not include the base file!
#endif
#define <macro name>_BASE_FILE_4DM_INCLUDED


#ifndef __COMPILING_FROM_OUTSIDE_12D
#include "src/build.4dm"
#else
#include "<my file path>/src/build.4dm"
#endif



void main()
// --------------------------------------------------------
// --------------------------------------------------------
{
	Integer ret = show_panel();
	if (ret == Shutdown_code) {
		// Exit quickly
		return;
	}

	return;
}
```

### Build File

This is the `4dm` file that will handle the inclusion of all the other `4dm` files and header file implementations in the project, along with build settings. This should not be included by any file other than the main file.

```
#ifndef INCLUDE_BUILD_4DM
#define INCLUDE_BUILD_4DM

// Build settings

#define RELEASE
//#define DEBUG

#define <my project specific build setting, if I have one> 1

// Build logic

#if !defined(DEBUG) && !defined(RELEASE)
#error Build mode unspecified : <RELEASE|DEBUG>
#endif

// Release override
#ifdef RELEASE
#undef DEBUG
#undef <my project specific build setting, if I have one>
#endif


// Source files, any order
#include "<something>_panel.4dm"
#include "<some other thing>.4dm"
#include "<etc>.4dm"


// Error for multiple inclusions of build.4dm
#else
#error Do not include build.4dm more than once
#endif
```

### Header File

Each `4dm` (excluding the base and build files) should come with an associated header file. This header file should have the pre-processor macros relevant to that file, and the prototypes of all the functions in the `4dm`.

For example, in the header of a panel `4dm` file, I would expect to see `DEFAULT_<field name>` for the fields of the panel and `RETURN_<panel name>_<meaning>` for the possible `return`s of the panel.

In the header of a regular `4dm` file, I would expect to see `enum`s relevant to that file.

### Function Template

```
<return_type> <function_name>(<parameters,...>)
// ----------------------------------------------------------------
  // Explanation of function use
  // any other important details
// ----------------------------------------------------------------
{
  // code...
}
```

### Standard Shipped Files

There is one standard shipped file to concern ourselves with called `set_ups.h`.
It is called using `#include <set_ups.h>`. This contains a number of pre-processor constants, like flags and mock-`enum`s.

### Source Files

The source `4dm` files is where the implementation occurs. These include all necessary headers at the start of the file, after the include guard.

## Formatting

| Standard     |
| ------------ |
| Align things |
|              |

## Code

### Constants
As there are no runtime constants, for `Text`/`Real`/`Integer`/`Integer64`/etc is it preferred to use object-like pre-processor macros.

There are no `enum`s, so object-like pre-processor macros are conventionally used in place of those as well. For many 12d functions, the user has to define the `enum`s themselves, but some are covered in `set_ups.h`.

### Magic Numbers

For unchanging, uncalculated values, use an object-like pre-processor macro to represent the value. For calculated values, use a runtime variable. This is not a universal rule, as many values will be self evident by the function signature alone i.e. `Set_data(message_box, "Panel finished");`
The scaffold provides `extended_set_ups.h`, which holds many common magic number replacements.

### Function Returns

Most inbuilt 12d library calls return 0 for success, so I tend to define `#define SUCCESS 0`, and use that for my functions. For generic failures, I use `#define FAILURE -1`. However if different modes of failure are important to know, implement additional object-like pre-processor macros to suit. Failure `return` codes are negative.

### Architecture

Typical 12d panels are structured to  revolve around `Wait_on_events(Integer64 id, Text cmd, Text msg)`. The scaffold has an implemented custom event queue, so that the entire macro can be event-based, rather than just the GUI elements. Event based architecture is preferred for looser coupling.

In further pursuit of loose coupling, macros should obey Model-View-Controller architecture.

### Honest / Dishonest Functions

A function is honest if the data it accesses is limited to it's parameters, and is dishonest if it does not. An example of an honest function would be `To_text(Integer)`, which accesses nothing but the parameter provided. An example of a dishonest function would be Print(), which writes to the output window. Another dishonest function would be `Get_time().`
Where possible, prioritise creating honest functions. For performance-critical code it might be permissible to ignore this.

### Data Structures

The macro language does not have `struct`s, but it does have `Attributes`. `Model`s, `Element`s, projects, macros and `Attributes` themselves can have `Attributes`. Attributes have names, positions and a value, unless they are a group Attribute. The value can be `Text`, `Guid`, `Uid`, `Real`, `Integer` and `Integer64`. I don't know what an `Attribute_Blob` is but supposedly those too.
The point being made is that `Attributes` can act as a substitute for `struct`s since they allow for a group of values to be passed around, each with a unique name. Custom accessor functions can be written for each mock-`struct` to simulate `struct`s. These mock-`struct`s would be capable of "member" mock-`struct`s, which is powerful. `Attributes` are also easy to store and debug.
 For non-performance-critical code, the use is highly encouraged.

### Comparisons

Prioritise switches over comparisons, especially always for mock-`enum` situations. Recall that text can be used in `switch`es.

### Appending

When constructing a panel, order and format the appending to match the actual layout, like so:
```
Append(vgroup, panel);
{
  Append(info_box, vgroup);
  Append(message , vgroup);
  Append(bgroup  , vgroup);
  {
    Append(bn_retry , bgroup);
    Append(bn_ignore, bgroup);
    Append(bn_stop  , bgroup);
  }
}
```


## Debugging

These are the two most standard debug statements.
`#define DVAR1(I01) Print("DEBUG | "); Print(#I01); Print(I01); Print();
`#define D2(I01, I02) Print("DEBUG | ");  Print(I01); Print(I02); Print();`
These should be left between major code components, and in places which should not be reachable i.e. the `default` in a `switch` statement that is expecting to cover every `case` explicitly.
Typically they exist within a self-contained header file, included in the build file before any other files, and are conditionally defined depending on the build mode. Typically `D1`-`D8` and `DVAR1`-`DVAR8` are defined.


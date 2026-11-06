The 12d Programming Language (12dPL) uses C-style syntax but varies from C.
## Terminology

| Term  | Meaning                    |
| ----- | -------------------------- |
| Macro | Primarily, a 12dPL program |

## Differences

| C Behaviour                                                                      | 12dPL Behaviour                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0-based indexing                                                                 | 1-based indexing                                                                                                                                                                                                                                                                                                                                                                                               |
| all programs start in `int main()`                                               | all programs start in `void main()`                                                                                                                                                                                                                                                                                                                                                                            |
| No limiting syntax for global variables                                          | global variables must be declared inside curly braces<br>                                                                                                                                                                                                                                                                                                                                                      |
| Pointers                                                                         | No pointers                                                                                                                                                                                                                                                                                                                                                                                                    |
| Structs                                                                          | No structs                                                                                                                                                                                                                                                                                                                                                                                                     |
| bool, int, double, etc                                                           | Completely different types -> 12dpl_data_types_documentation.json                                                                                                                                                                                                                                                                                                                                              |
| printf, scanf                                                                    | Completely different functions -> 12dpl_functions_documentation.json                                                                                                                                                                                                                                                                                                                                           |
| A variable declared in the `for`-init-statement is scoped to the `for` statement | A variable declared in the `for`-init-statement remains accessible after the `for` statement                                                                                                                                                                                                                                                                                                                   |
| Short circuit evaluation                                                         | No short-circuit evaluation, every condition is checked                                                                                                                                                                                                                                                                                                                                                        |
| Pre-processor supports `'`, `"` in `#error`                                      | Just avoid it                                                                                                                                                                                                                                                                                                                                                                                                  |
| Concat strings with "part 1" "part 2"                                            | Concat text with "part one" + my_text_var + "part 2"                                                                                                                                                                                                                                                                                                                                                           |
| `void` type is only for function `return`s                                       | It's not meant to, but `void` type compiles as a variable <br>without issue                                                                                                                                                                                                                                                                                                                                    |
| `switch` can have code wherever                                                  | Curly braces are mandatory for `case`/`default` statements<br>optional `break;` allowed after the curly braces<br>i.e.<br>switch (i) {<br>case 1 : {<br>    // code in brace only<br>  } <optional break; allowed><br>}                                                                                                                                                                                        |
| `#include` searches the local folder                                             | Everything works normally if the compiler is called directly. If it is called indirectly, through the 12d Compile options, the `#include` path in the base file is set to the project directory, hence the need for the following pre-processor logic to handle both cases:<br>`#ifndef __COMPILING_OUTSIDE_12D`<br>`#include "example.4dm"`<br>`#else`<br>`#include "<my_file_path>/example.4dm"`<br>`#endif` |


## 12dPL Features

| Feature                                                     |
| ----------------------------------------------------------- |
| `switch` supports `Integer64`/`Integer`/`Text`/`Real` types |
| `Text` supports `==` for string comparison                  |
| 'c' is an `Integer`, "c" is `Text`                          |

## 12dPL GUI

| Details                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------- |
| All GUI elements are derived from `Widget`s                                                                                |
| You can cast a GUI element to a `Widget` like so:<br>`Widget cast_to_widget(Widget widget) {`<br>  `return widget;`<br>`}` |
| widgets can be appended in any order                                                                                       |
| must finish appending before calling `Show_widget(Panel)`                                                                  |
| Set_data(...) should be called after `Show_widget(Panel)`                                                                  |
| `Show_widget(Panel)` is how the panel is brought to the display                                                            |
| Any special `Set_visible(...)` logic must be called each time the panel is shown                                           |

## 12d Environment

| Feature                                                                              |
| ------------------------------------------------------------------------------------ |
| There are none-to-many views                                                         |
| Text is not supported in Perspective view                                            |
| Project has tins and models                                                          |
| Models can have elements and tins                                                    |
| Elements is a broad category, mainly concerned with super strings                    |
| Super strings have vertexes                                                          |
| Models and tins can be displayed on views                                            |
| Tins can exist without models, suboptimal                                            |
| There is an output window, it is a `Log_Box` and is where `Print(...)` statements go |

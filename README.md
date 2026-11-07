# VS Code 12d Debugger

Step-through debugging of 12d Model macros (12dPL) from VS Code: breakpoints,
step over / in / out, pause, call stack, and variable values.

## How to use

1. Install the extension or the `vsix` file.
2. Download or compile the `4do`.
3. Run the `4do`.

And I'd recommending adding this to `user_menus.4d`:

```C
[User Macros] {
  Button "Debug/Compile" fill in
}
```


## How it works

The macro is copied and rewritten with a bunch of calls to the VS Code extension.


### Settings

Options live in the Settings editor: **File → Preferences → Settings**, search
for `12dpl`. The **12dPL: Open Debugger Settings** command also opens it.

| Setting | What it does |
| --- | --- |
| `12dpl.stopOnEntry` | Pause on the first line of `main`. |
| `12dpl.inspectors`, `12dpl.inspectDepth` | See [Inspectors](#inspectors). |
| `12dpl.includePaths` | Extra folders to search for quoted `#include`s. 12d's own `CPATH` folders are searched too, after these. |
| `12dpl.compileCommand` | An `.exe` to run after instrumenting, started directly with no shell. `${file}` is the instrumented entry file and `${outDir}` its folder. Quote parts with spaces, or give a list. |
| `12dpl.trace` | Log every message to and from the macro in the Debug Console. |

The instrumented copy goes in `.12dpl-debug` in the workspace folder that
holds the macro, or next to the macro if no folder is open. It is deleted
and recreated on every launch.

If the instrumented macro is run without the debugger listening, it gives up
after 5 seconds, prints a note and runs normally.

## Inspectors

Most 12d types (`Element`, `Model`, `Attributes`, `Dynamic_Integer`, ...) have
no text form, so the debugger can only show them through functions that read
them. An inspector is one such function, given as its 12dPL signature in
the `12dpl.inspectors` setting (in `settings.json` form):

```json
"12dpl.inspectors": [
  "Integer Get_name(Element elt, Text &name)",
  "Integer Get_colour(Element elt, Integer &colour)",
  "Integer Get_model(Element elt, Model &model)",
  "Integer Get_attribute(Element elt, \"width\", Real &width)",
  "Integer Get_number_of_items(Dynamic_Integer list, Integer &count)"
]
```

- The first parameter is the value being inspected; its type is the type the
  inspector is for.
- Each `&` parameter becomes a member, named after the parameter. A variable
  `l_kerb` of type `Element` then shows as
  `Element {name: "kerb", colour: 3, model: Model {name: "design"}, width: 0.15}`
  and expands into those members in the Variables view. Hovering or watching
  `l_kerb.model.name` works too.
- Other parameters must be literals (numbers, strings, or a `#define` name)
  and are passed as written.
- With no `&` parameters, the return value is the member, named after the
  function: `"Integer Get_number_of_items(Dynamic_Integer list)"`.
- If an inspector returns `Integer` and the result is not 0, the member shows
  `<Get_x returned N>` in place of a value.
- A member whose type has inspectors is expanded too, down to `inspectDepth`
  levels (default 3).
- Your own functions work as inspectors
- Inspectors for a type replace the built-in ones for that type. The built-ins
  are: `Element`: `Get_name`, `Get_type`, `Get_points`, `Get_model`;
  `Model`: `Get_name`, `Get_number_of_items`.
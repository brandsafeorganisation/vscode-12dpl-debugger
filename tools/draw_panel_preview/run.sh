#!/bin/bash
# Build the Draw UI panel as a Linux program and play scenarios through it.
# Usage: ./run.sh                       every scenario in scenarios/
#        ./run.sh scenarios/x.txt ...   just those
# A scenario's first line may be "# args: -dark" (the macro's command line).
# Snapshots go to out/<name>.png.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
PANEL="$HERE/../../companions/draw_panel/compile_debug_draw_panel.4dm"
mkdir -p "$HERE/build" "$HERE/out"

python3 "$HERE/translate.py" "$PANEL" "$HERE/build/panel.cpp"
cat >> "$HERE/build/panel.cpp" <<'X'
void preview_load(const char*, int, char**);
int main(int argc, char **argv) { preview_load(argv[1], argc - 2, argv + 2); macro_main(); return 0; }
X
g++ -O1 -g -std=c++17 -w -fsanitize=address,undefined -I "$HERE" -o "$HERE/build/panel" "$HERE/build/panel.cpp" "$HERE/preview.cpp"

SCENARIOS=("$@")
[ ${#SCENARIOS[@]} -eq 0 ] && SCENARIOS=("$HERE"/scenarios/*.txt)
# a folder of macros for the file browser
mkdir -p "$HERE/run/macros/lib" "$HERE/run/macros/old"
mkdir -p "$HERE/run/macros/many" && for i in $(seq -w 1 25); do touch "$HERE/run/macros/many/macro_$i.4dm"; done
touch "$HERE/run/macros/my_macro.4dm" "$HERE/run/macros/other.4dm" "$HERE/run/macros/notes.txt" "$HERE/run/macros/lib/util.4dm"
for s in "${SCENARIOS[@]}"; do
  s=$(cd "$(dirname "$s")" && pwd)/$(basename "$s")
  ARGS=$(sed -n 's/^# args: //p' "$s" | head -1)
  echo "== $(basename "$s") $ARGS"
  (cd "$HERE/run" && PREVIEW_OUT="$HERE/out" PREVIEW_VSCODE=$(sed -n 's/^# vscode: //p' "$s" | head -1) \
     "$HERE/build/panel" "$s" $ARGS)
done
python3 "$HERE/topng.py" "$HERE/out"

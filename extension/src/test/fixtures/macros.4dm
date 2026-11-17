// Object-like and function-like macros, including multi-line ones.
// A line ending in //> must be a breakpoint line; no other line may be.

#define MAX_ITEMS 10
#  define   SPACED_OUT    "spaced"
#define EMPTY_MACRO
#define TWO_PRINTS(a, b) \
  Print(a);              \
  Print(b)
#define CHECK(x) if ((x) != 0) { \
    Print("check failed\n");     \
    return 1;                    \
  }
#define TRY(x) CHECK(x)
#define BEGIN_LOOP(i, n) for (Integer i = 1; i <= n; i++) {
#define END_LOOP }
#define BEGIN_BLOCK {
#define END_BLOCK END_LOOP
#define Int Integer
#define Name Text
#define SQUARE(x) ((x) * (x))
#define LOG(msg) Print(msg + "\n");

{
  Int   g_count = 0;
  Name  g_title = "macros";
}

Integer use_macros(Int p_n, Name &p_label)
{
  Int l_total = 0;                                    //>
  TWO_PRINTS("first",                                 //>
             "second");
  CHECK(l_total)                                      //>
  Name l_after_check = "x";                           //>
  TRY(p_n - 1)                                        //>
  l_total = SQUARE(p_n) +                             //>
            SQUARE(
              MAX_ITEMS
            );
  LOG("no semicolon needed")                          //>
  LOG("one anyway");                                  //>
  BEGIN_LOOP(l_i, 3)                                  //>
    l_total += l_i;                                   //>
  END_LOOP
  BEGIN_BLOCK                                         //>
    Int l_inner = 1;                                  //>
    l_total += l_inner;                               //>
  END_BLOCK
  EMPTY_MACRO;                                        //>
  p_label = SPACED_OUT;                               //>
#undef SQUARE
  Int l_last = l_total;                               //>
  return l_last;                                      //>
}

void main()
{
  Name l_label = "";                                  //>
  use_macros(MAX_ITEMS, l_label);                     //>
}

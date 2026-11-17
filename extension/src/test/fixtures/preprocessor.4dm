// Conditional compilation. A line ending in //> must be a breakpoint line.
#ifndef PREPROCESSOR_FIXTURE
#define PREPROCESSOR_FIXTURE

#if 0
this is not 12dPL at all { { {
Integer broken(
#endif

#if 1
#define FEATURE 1
#else
#define FEATURE 0 }
#endif

void work(Integer p_a)
{
  Integer x = 0;                                   //>
#ifdef __COMPILING_OUTSIDE_12D
  x = 1;                                           //>
#elif FEATURE > 0
  x = 2;                                           //>
#else
  x = 3;                                           //>
#endif
  Integer y = Get_number_of_items(x,               //>
#if FEATURE
    1
#else
    2
#endif
  );
#if 0
  if (x) {
#else
  if (y) {                                         //>
#endif
    x++;                                           //>
  }
#   if   defined(SOMETHING)   &&   !defined(OTHER)
  if (x > 1) {                                     //>
    x = 0;                                         //>
#   else
  if (x > 2) {                                     //>
    x = 1;                                         //>
#   endif
  }
#if 0 // with a comment
  x = "it's fine";
#endif
}

void main()
{
  work(1);                                         //>
}

#endif

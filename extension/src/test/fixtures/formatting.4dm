// Unusual but legal formatting. A line ending in //> must be a breakpoint line.

{Integer g_a=0;Text g_b="";}

Integer   one_liner(Integer a){if(a)return 1;return 0;}   //>

Integer
k_and_r_name
(
  Integer p_a ,
  Text    &p_b
)
{
	Integer	tabbed	=	p_a;                     //>
  if(tabbed>0){tabbed--;}else{tabbed++;}           //>
  if (tabbed > 0)                                  //>
  {
    tabbed = 0;                                    //>
  }
  else if (tabbed < 0)
  {
    tabbed = 1;                                    //>
  }
  else
    tabbed = 2;
  while(tabbed<3)                                  //>
    tabbed++;
  for (Integer i = 0;                              //>
       i < 3;
       i++)
  {
    p_b += "x";                                    //>
  }
  Integer    /* comment in the middle */ x =       //>
    1;
  x = x +                                          //>
      2   // trailing comment with a ; and { in it
      + 3;
  Text s = "a } string { with ; things";           //>
  Text q = "escaped \" quote ; {";                 //>
  do                                               //>
  {
    x--;                                           //>
  }
  while (x > 0);
  switch (x)                                       //>
  {
    case 0 :
    {
      x = 10;                                      //>
    }
    break;
    default :
    {
      x = 20;                                      //>
    }
  }
  { Integer y = 1; x += y; }                       //>
  x++; x--; x *= 2;                                //>
  if (x) return(x);                                //>
  return                                           //>
    -1;
}

void main()
{
  Text t;                                          //>
  k_and_r_name(one_liner(1),t);                    //>
}

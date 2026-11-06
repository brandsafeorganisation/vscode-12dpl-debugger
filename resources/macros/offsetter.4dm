#ifndef OFFSETTER_4DM_INCLUDED
#define OFFSETTER_4DM_INCLUDED

Integer apply_offset(
  Element &string, Real x_offset, Real y_offset,
  Element &new_string
)
// ----------------------------------------------------------------
//  Terrible panel
// ----------------------------------------------------------------
{
  Integer num_verts = 0;
  Get_points(string, num_verts);
  for (Integer i = 0; i <= num_verts; i++) {

    Real x = 0.0, y = 0.0, z = 0.0;
    Get_data(string, i, x, y, z);

    x += x_offset;
    y += y_offset;

    Set_super_vertex_coord(new_string, i, x, y, z);

  }

  return 0;
}

#endif
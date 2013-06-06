//-*-C++-*-
#ifndef _TLBCORE_SOLID_GEOMETRY_H
#define _TLBCORE_SOLID_GEOMETRY_H

#include "./vec3.h"

struct mass_properties;

struct octree_node {
  octree_node(vec3 const &_center, float _scale);
  ~octree_node();

  octree_node *lookup(vec3 const &pt, float max_scale);

  vec3 center;
  float scale;

  octree_node *children[8];
};


struct stl_face {
  stl_face();
  stl_face(vec3 _v0, vec3 _v1, vec3 _v2);
  stl_face(vec3 _v0, vec3 _v1, vec3 _v2, vec3 _normal);
  ~stl_face();

  void calc_normal();

  bool ray_intersects(vec3 const &p, vec3 const &d, float &t) const;
  void transform(mat4 const &m);
  float get_area() const;
  vec3 get_e1() const;
  vec3 get_e2() const;
  bool is_degenerate() const;
  vec3 centroid() const;

  vec3 v0, v1, v2;
  vec3 normal;

};
void packet_rd_getfunc(packet &p, stl_face *it, size_t n);
void packet_wr_addfunc(packet &p, stl_face const *it, size_t n);

bool operator == (stl_face const &a, stl_face const &b);

struct stl_intersection {
  float t;
  struct stl_face face;
};

struct stl_solid {
  
  stl_solid();
  ~stl_solid();

  void read_binary_file(FILE *fp, double scale);
  void calc_bbox();
  bool ray_intersects(vec3 const &p, vec3 const &d) const;
  void transform(mat4 const &m);
  bool is_interior(vec3 const &pt) const;
  vector<stl_intersection> intersection_list(vec3 const &pt, vec3 const &dir) const;
  mass_properties get_mass_properties(double density);
  void remove_tiny_faces(float min_size);

  vec3 bbox_lo, bbox_hi;
  vector<stl_face> faces;
  
};

void packet_rd_getfunc(packet &p, stl_solid *it, size_t n);
void packet_wr_addfunc(packet &p, stl_solid const *it, size_t n);

struct mass_properties {
  mass_properties(double _volume, double _mass, double _area, vec3 _cm, mat3 _inertia_origin);
  
  mass_properties multiply_density(double factor);

  void calc_derived();
  static mass_properties all_zero();

  double density;
  double volume;
  double mass;
  double area;
  vec3 cm;
  mat3 inertia_origin;
  mat3 inertia_cm;
  vec3 rog_origin;
  vec3 rog_cm;
};
void packet_wr_addfunc(packet &p, mass_properties const *it, size_t n);
void packet_rd_getfunc(packet &p, mass_properties *it, size_t n);

mass_properties operator +(mass_properties const &a, mass_properties const &b);

ostream & operator << (ostream &s, mass_properties const &it);

#endif

//-*-C++-*-
#ifndef _TLBCORE_SOLID_GEOMETRY_H
#define _TLBCORE_SOLID_GEOMETRY_H

#include "./geom_math.h"

struct mass_properties;

struct octree_node {
  octree_node(Vec3 const &_center, float _scale);
  ~octree_node();

  octree_node *lookup(Vec3 const &pt, float max_scale);

  Vec3 center;
  float scale;

  octree_node *children[8];
};


struct stl_face {
  stl_face();
  stl_face(Vec3 _v0, Vec3 _v1, Vec3 _v2);
  stl_face(Vec3 _v0, Vec3 _v1, Vec3 _v2, Vec3 _normal);
  ~stl_face();

  void calc_normal();

  bool ray_intersects(Vec3 const &p, Vec3 const &d, float &t) const;
  void transform(Mat44 const &m);
  float get_area() const;
  Vec3 get_e1() const;
  Vec3 get_e2() const;
  bool is_degenerate() const;
  Vec3 centroid() const;

  Vec3 v0, v1, v2;
  Vec3 normal;

};
void packet_rd_value(packet &p, stl_face &it);
void packet_wr_value(packet &p, stl_face const &it);
void packet_rd_typetag(packet &p, stl_face &it);
void packet_wr_typetag(packet &p, stl_face const &it);

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
  bool ray_intersects(Vec3 const &p, Vec3 const &d) const;
  void transform(Mat44 const &m);
  bool is_interior(Vec3 const &pt) const;
  vector<stl_intersection> intersection_list(Vec3 const &pt, Vec3 const &dir) const;
  mass_properties get_mass_properties(double density);
  void remove_tiny_faces(float min_size);

  Vec3 bbox_lo, bbox_hi;
  vector<stl_face> faces;
  
};

void packet_rd_value(packet &p, stl_solid &it);
void packet_wr_value(packet &p, stl_solid const &it);
void packet_rd_typetag(packet &p, stl_solid &it);
void packet_wr_typetag(packet &p, stl_solid const &it);

struct mass_properties {
  mass_properties(double _volume, double _mass, double _area, Vec3 _cm, Mat33 _inertia_origin);
  
  mass_properties multiply_density(double factor);

  void calc_derived();
  static mass_properties allZero();

  double density;
  double volume;
  double mass;
  double area;
  Vec3 cm;
  Mat33 inertia_origin;
  Mat33 inertia_cm;
  Vec3 rog_origin;
  Vec3 rog_cm;
};

void packet_rd_value(packet &p, mass_properties &it);
void packet_wr_value(packet &p, mass_properties const &it);
void packet_rd_typetag(packet &p, mass_properties &it);
void packet_wr_typetag(packet &p, mass_properties const &it);

mass_properties operator +(mass_properties const &a, mass_properties const &b);

ostream & operator << (ostream &s, mass_properties const &it);

#endif

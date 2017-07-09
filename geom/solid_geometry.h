//-*-C++-*-
#ifndef _TLBCORE_SOLID_GEOMETRY_H
#define _TLBCORE_SOLID_GEOMETRY_H

struct StlMassProperties;

struct OctreeNode {
  explicit OctreeNode(arma::vec3 const &_center, double _scale);
  ~OctreeNode();
  OctreeNode(OctreeNode const &) = delete;
  OctreeNode(OctreeNode &&) = delete;
  OctreeNode & operator = (OctreeNode const &) = delete;
  OctreeNode & operator = (OctreeNode &&) = delete;

  OctreeNode *lookup(arma::vec3 const &pt, double maxScale);

  arma::vec3 center;
  double scale;

  OctreeNode *children[8];
};


struct StlFace {
  StlFace();
  explicit StlFace(arma::vec3 const &_v0, arma::vec3 const &_v1, arma::vec3 const &_v2);
  explicit StlFace(arma::vec3 const &_v0, arma::vec3 const &_v1, arma::vec3 const &_v2, arma::vec3 const &_normal);

  void calcNormal();

  bool rayIntersects(arma::vec3 const &p, arma::vec3 const &d, double &t) const;
  void transform(arma::mat44 const &m);
  double getArea() const;
  arma::vec3 getE1() const;
  arma::vec3 getE2() const;
  bool isDegenerate() const;
  arma::vec3 getCentroid() const;

  arma::vec3 v0, v1, v2;
  arma::vec3 normal;

};
void packet_rd_value(packet &p, StlFace &it);
void packet_wr_value(packet &p, StlFace const &it);
void packet_rd_typetag(packet &p, StlFace &it);
void packet_wr_typetag(packet &p, StlFace const &it);

bool operator == (StlFace const &a, StlFace const &b);

struct StlIntersection {
  double t;
  struct StlFace face;
};

struct StlWebglMesh {
  StlWebglMesh() {}

  arma::vec coords;
  arma::vec normals;
  arma::Col<S64> indexes;
};

struct StlSolid {

  StlSolid();

  void readBinaryFile(FILE *fp, double scale);
  void writeBinaryFile(FILE *fp, double scale);
  void merge(StlSolid const *other);
  void calcBbox();
  double getMaxScale() const;
  bool rayIntersects(arma::vec3 const &p, arma::vec3 const &d) const;
  void transform(arma::mat44 const &m);
  bool isInterior(arma::vec3 const &pt) const;
  vector<StlIntersection> getIntersections(arma::vec3 const &p, arma::vec3 const &d) const;
  StlMassProperties getStlMassProperties(double density) const;
  StlWebglMesh exportWebglMesh(double eps) const;
  void removeTinyFaces(double minSize);
  arma::vec3 analyzeHole(int axisi);
  pair<double, arma::vec3> estimateVolume();

  arma::vec3 bboxLo, bboxHi;
  vector<StlFace> faces;

};

ostream & operator << (ostream &s, StlSolid const &it);

void packet_rd_value(packet &p, StlSolid &it);
void packet_wr_value(packet &p, StlSolid const &it);
void packet_rd_typetag(packet &p, StlSolid &it);
void packet_wr_typetag(packet &p, StlSolid const &it);

struct StlMassProperties {
  StlMassProperties();
  explicit StlMassProperties(double _volume, double _mass, double _area, arma::vec3 const &_cm, arma::mat33 const &_inertiaOrigin);

  StlMassProperties multiplyDensity(double factor);

  void calcDerived();

  double density;
  double volume;
  double mass;
  double area;
  arma::vec3 cm;
  arma::mat33 inertiaOrigin;
  arma::mat33 inertiaCm;
  arma::vec3 rogOrigin;
  arma::vec3 rogCm;
};

void packet_rd_value(packet &p, StlMassProperties &it);
void packet_wr_value(packet &p, StlMassProperties const &it);
void packet_rd_typetag(packet &p, StlMassProperties &it);
void packet_wr_typetag(packet &p, StlMassProperties const &it);

StlMassProperties operator +(StlMassProperties const &a, StlMassProperties const &b);

ostream & operator << (ostream &s, StlMassProperties const &it);

#endif

#include "../common/std_headers.h"
#include "./geom_math.h"
#include "./solid_geometry.h"
#include "../numerical/haltonseq.h"
#include "../common/jsonio.h"

using namespace arma;

OctreeNode::OctreeNode(vec3 const &_center, double _scale)
  :center(_center), scale(_scale), children {nullptr}
{
  //for (auto & it : children) it = nullptr;
  //for (int i=0; i<8; i++) children[i] = nullptr;
}

OctreeNode::~OctreeNode()
{
  for (auto & it : children) delete it;
  //for (int i=0; i<8; i++) delete children[i];
}

OctreeNode *OctreeNode::lookup(vec3 const &pt, double maxScale)
{
  if (scale < maxScale) return this;
  int index = (((pt[0] >= center[0]) ? 4:0) |
               ((pt[1] >= center[1]) ? 2:0) |
               ((pt[2] >= center[2]) ? 1:0));
  if (!children[index]) {
    vec3 newCenter { center[0] + scale * ((index&4) ? +0.5 : -0.5), center[1] + scale * ((index&2) ? +0.5 : -0.5), center[2] + scale * ((index&1) ? +0.5 : -0.5) };

    children[index] = new OctreeNode(newCenter, scale*0.5);
  }
  return children[index]->lookup(pt, maxScale);
}


/* Simple reader for STL files. Only handles binary.
   See http://en.wikipedia.org/wiki/STL_(file_format)
*/

StlFace::StlFace()
{
}

StlFace::StlFace(arma::vec3 const &_v0, arma::vec3 const &_v1, arma::vec3 const &_v2)
  :v0(_v0),
   v1(_v1),
   v2(_v2)
{
  calcNormal();
}


StlFace::StlFace(vec3 const &_v0, vec3 const &_v1, vec3 const &_v2, vec3 const &_normal)
  :v0(_v0),
   v1(_v1),
   v2(_v2),
   normal(normalise(_normal))
{
#if 0
  vec3 cpnorm = normalise(cross(v1-v0, v2-v0));
  double dp = dot(normal, cpnorm);
  if (dp<0.95 || dp>1.05) {
    cout << "Bad normal dp=" << dp << " area=" << get_area() << "\n";
    cout << "  v0=" << v0 << "\n";
    cout << "  v1=" << v1 << "\n";
    cout << "  v2=" << v2 << "\n";
    cout << "  e1=" << (v1-v0) << "\n";
    cout << "  e2=" << (v2-v0) << "\n";
    cout << "  normal=" << normal << "\n";
    cout << "  cpnorm=" << cpnorm << "\n";
  }
#endif
}

void StlFace::calcNormal()
{
  normal = normalise(cross(v1-v0, v2-v0));
}

// Test whether the vector starting at p and of length/direction d intersects me
#ifdef USE_SLOW_StlFace__rayIntersects
bool
StlFace::rayIntersects(vec3 const &p, vec3 const &d, double &t) const
{
  vec3 e1 = v1-v0;
  vec3 e2 = v2-v0;

  vec3 h = cross(d, e2);
  double a = dot(e1, h);
  if (fabs(a)<1e-10) return false;

  double f=1.0/a;

  vec3 s=p-v0;
  double u = f * dot(s, h);
  if (u<0.0 || u>1.0) return false;

  vec3 q = cross(s, e1);
  double v = f * dot(d, q);
  if (v<0.0 || u+v>1.0) return false;

  t = f * dot(e2, q);
  if (t < 1e-10) return false;

  return true;
}
#else
// Special fast version since we do a lot of this
bool
StlFace::rayIntersects(vec3 const &p, vec3 const &d, double &t) const
{
  double e1_x = v1[0]-v0[0];
  double e1_y = v1[1]-v0[1];
  double e1_z = v1[2]-v0[2];
  double e2_x = v2[0]-v0[0];
  double e2_y = v2[1]-v0[1];
  double e2_z = v2[2]-v0[2];

  double h_x = d[1]*e2_z - d[2]*e2_y;
  double h_y = d[2]*e2_x - d[0]*e2_z;
  double h_z = d[0]*e2_y - d[1]*e2_x;

  double a = e1_x*h_x + e1_y*h_y + e1_z*h_z;
  if (a<1e-10 && a>-1e-10) return false;

  double f=1.0/a;

  double s_x = p[0] - v0[0];
  double s_y = p[1] - v0[1];
  double s_z = p[2] - v0[2];

  double u = f*s_x*h_x + f*s_y*h_y + f*s_z*h_z;
  if (u<0.0 || u>1.0) return false;

  double q_x = s_y*e1_z - s_z*e1_y;
  double q_y = s_z*e1_x - s_x*e1_z;
  double q_z = s_x*e1_y - s_y*e1_x;

  double v = f*d[0]*q_x + f*d[1]*q_y + f*d[2]*q_z;
  if (v<0.0 || u+v>1.0) return false;

  t = f*e2_x*q_x + f*e2_y*q_y + f*e2_z*q_z;
  if (t < 1e-10) return false;

  return true;
}
#endif

void
StlFace::transform(mat44 const &m)
{
  v0 = vecFromHomo(m * vecToHomo(v0));
  v1 = vecFromHomo(m * vecToHomo(v1));
  v2 = vecFromHomo(m * vecToHomo(v2));

  normal = justRotation(m) * normal;
}

double
StlFace::getArea() const
{
  vec3 e1 = v1-v0;
  vec3 e2 = v2-v0;

  return norm(cross(e1, e2), 2)*0.5;
}

vec3
StlFace::getE1() const
{
  return v1-v0;
}

vec3
StlFace::getE2() const
{
  return v2-v0;
}

bool StlFace::isDegenerate() const
{
  const double eps = 1e-9;
  return (norm(v0 - v1, 2) < eps ||
          norm(v2 - v1, 2) < eps ||
          norm(v0 - v2, 2) < eps);
}

vec3 StlFace::getCentroid() const
{
  return (v0 + v1 + v2) / 3.0;
}

bool operator == (StlFace const &a, StlFace const &b)
{
  return (all(a.normal == b.normal) &&
          all(a.v0 == b.v0) &&
          all(a.v1 == b.v1) &&
          all(a.v2 == b.v2));
}

// ----------------------------------------------------------------------

StlSolid::StlSolid()
{
}


ostream & operator << (ostream &s, StlSolid const &it)
{
  s << "StlSolid(nFaces=" << it.faces.size() << " maxScale=" << it.getMaxScale() << ")";
  return s;
}

void
StlSolid::readBinaryFile(FILE *fp, double scale)
{
  // See https://en.wikipedia.org/wiki/STL_(file_format)
  char dummyline[80];
  if (fread(dummyline, 1, 80, fp) != 80) throw runtime_error("reading header");

  uint32_t nTriangles=0;
  if (fread(&nTriangles, sizeof(uint32_t), 1, fp) != 1) throw runtime_error("reading n_triangles");

  faces.reserve(faces.size() + nTriangles);

  for (uint32_t ti=0; ti<nTriangles; ti++) {

    float data[12];
    if (fread(&data, sizeof(float), 12, fp) != 12) throw runtime_error("reading 12 floats");

    vec3 n {data[0], data[1], data[2]};
    vec3 v0 {data[3] * scale, data[4] * scale, data[5] * scale};
    vec3 v1 {data[6] * scale, data[7] * scale, data[8] * scale};
    vec3 v2 {data[9] * scale, data[10] * scale, data[11] * scale};

    StlFace face(v0, v1, v2, n);

    uint16_t attrByteCount = 0;
    if (fread(&attrByteCount, sizeof(uint16_t), 1, fp) != 1) throw runtime_error("reading attrByteCount");

    if (attrByteCount != 0) throw runtime_error(stringprintf("bad attrByteCount=%d", (int)attrByteCount).c_str());

    faces.push_back(face);

  }
  calcBbox();

  if (0) eprintf("Read %d faces\n", nTriangles);
}

void
StlSolid::writeBinaryFile(FILE *fp, double scale)
{
  char dummyline[80];
  memset(dummyline, 0, 80);
  if (fwrite(dummyline, 1, 80, fp) != 80) throw runtime_error("writing header");

  auto nTriangles = static_cast<uint32_t>(faces.size());
  if (fwrite(&nTriangles, sizeof(uint32_t), 1, fp) != 1) throw runtime_error("writing n_triangles");

  for (uint32_t ti=0; ti<nTriangles; ti++) {
    StlFace const &face = faces[ti];

    float data[12];

    data[0] = face.normal[0];
    data[1] = face.normal[1];
    data[2] = face.normal[2];

    data[3] = face.v0[0] / scale;
    data[4] = face.v0[1] / scale;
    data[5] = face.v0[2] / scale;
    data[6] = face.v1[0] / scale;
    data[7] = face.v1[1] / scale;
    data[8] = face.v1[2] / scale;
    data[9] = face.v2[0] / scale;
    data[10] = face.v2[1] / scale;
    data[11] = face.v2[2] / scale;

    if (fwrite(&data, sizeof(float), 12, fp) != 12) throw runtime_error("writing 12 floats");

    uint16_t attrByteCount = 0;
    if (fwrite(&attrByteCount, sizeof(uint16_t), 1, fp) != 1) throw runtime_error("writing attrByteCount");
  }

  if (0) eprintf("Wrote %d faces\n", nTriangles);
}

void
StlSolid::merge(StlSolid const *other)
{
  for (auto &face : other->faces) {
    faces.push_back(face);
  }
  calcBbox();
}


void
StlSolid::transform(mat44 const &m)
{
  for (auto &face : faces) {
    face.transform(m);
  }
  calcBbox();
}


void
StlSolid::calcBbox()
{
  if (faces.empty()) {
    bboxLo.zeros();
    bboxHi.zeros();
    return;
  }

  vec3 lo = faces[0].v0;
  vec3 hi = faces[0].v0;

  for (auto &face: faces) {

    lo[0] = min(lo[0], face.v0[0]);
    lo[1] = min(lo[1], face.v0[1]);
    lo[2] = min(lo[2], face.v0[2]);
    lo[0] = min(lo[0], face.v1[0]);
    lo[1] = min(lo[1], face.v1[1]);
    lo[2] = min(lo[2], face.v1[2]);
    lo[0] = min(lo[0], face.v2[0]);
    lo[1] = min(lo[1], face.v2[1]);
    lo[2] = min(lo[2], face.v2[2]);

    hi[0] = max(hi[0], face.v0[0]);
    hi[1] = max(hi[1], face.v0[1]);
    hi[2] = max(hi[2], face.v0[2]);
    hi[0] = max(hi[0], face.v1[0]);
    hi[1] = max(hi[1], face.v1[1]);
    hi[2] = max(hi[2], face.v1[2]);
    hi[0] = max(hi[0], face.v2[0]);
    hi[1] = max(hi[1], face.v2[1]);
    hi[2] = max(hi[2], face.v2[2]);

  }
  bboxLo = lo;
  bboxHi = hi;
}

bool
StlSolid::rayIntersects(vec3 const &p, vec3 const &d) const
{
  for (auto &face : faces) {
    double t;
    if (face.rayIntersects(p, d, t)) {
      return true;
    }
  }
  return false;
}

/*
  It's inside if there are an odd number of faces in line with a ray.
  We choose (1, 0, 0) here, but any ray should give the same number.
  That might be a good test to add, in fact.
 */
bool
StlSolid::isInterior(vec3 const &pt) const
{
  bool ret = false;
  vec3 dir;
  dir[0] = 1;
  dir[1] = 0;
  dir[2] = 0;

  for (auto &face : faces) {
    double t;
    if (face.rayIntersects(pt, dir, t)) {
      ret = !ret;
    }
  }
  return ret;
}

bool operator < (StlIntersection const &a, StlIntersection const &b)
{
  return a.t < b.t;
}

vector<StlIntersection>
StlSolid::getIntersections(vec3 const &p, vec3 const &d) const
{
  vector<StlIntersection> ret;

  for (auto &face : faces) {
    double t;
    if (face.rayIntersects(p, d, t)) {
      StlIntersection si;
      si.face = face;
      si.t = t;
      ret.push_back(si);
    }
  }

  if (ret.size() % 2) {
    // If an odd number, we must have started inside so add fake face
    StlIntersection si;
    si.face.normal = normalise(d * -1.0); // points opposite to d
    si.face.v0.zeros();
    si.face.v1.zeros();
    si.face.v2.zeros();
    si.t = 0.0;
    ret.push_back(si);
  }

  sort(ret.begin(), ret.end());

  return ret;
}

StlMassProperties
StlSolid::getStlMassProperties(double density) const
{
  double sum_area = 0.0;
  double sum_1  = 0.0;
  double sum_x  = 0.0;
  double sum_y  = 0.0;
  double sum_z  = 0.0;
  double sum_xx = 0.0;
  double sum_yy = 0.0;
  double sum_zz = 0.0;
  double sum_xy = 0.0;
  double sum_yz = 0.0;
  double sum_zx = 0.0;

  for (auto &f : faces) {

    vec3 v0 = f.v0;
    vec3 v1 = f.v1;
    vec3 v2 = f.v2;
    vec3 e1 = v1-v0;
    vec3 e2 = v2-v0;

    vec3 d = cross(e1, e2);   // l^2

    vec3 f1 = v0 + v1 + v2;   // l^1

    vec3 f2;
    f2[0] = sqr(v0[0]) + v0[0]*v1[0] + sqr(v1[0]) + v2[0]*f1[0];
    f2[1] = sqr(v0[1]) + v0[1]*v1[1] + sqr(v1[1]) + v2[1]*f1[1];
    f2[2] = sqr(v0[2]) + v0[2]*v1[2] + sqr(v1[2]) + v2[2]*f1[2]; // l^2

    vec3 f3;
    f3[0] = pow(v0[0], 3) + sqr(v0[0])*v1[0] + v0[0]*sqr(v1[0]) + pow(v1[0], 3) + v2[0]*f2[0];
    f3[1] = pow(v0[1], 3) + sqr(v0[1])*v1[1] + v0[1]*sqr(v1[1]) + pow(v1[1], 3) + v2[1]*f2[1];
    f3[2] = pow(v0[2], 3) + sqr(v0[2])*v1[2] + v0[2]*sqr(v1[2]) + pow(v1[2], 3) + v2[2]*f2[2]; // l^3

    vec3 g0;
    g0[0] = f2[0] + v0[0]*(f1[0] + v0[0]);
    g0[1] = f2[1] + v0[1]*(f1[1] + v0[1]);
    g0[2] = f2[2] + v0[2]*(f1[2] + v0[2]); // l^2
    vec3 g1;
    g1[0] = f2[0] + v1[0]*(f1[0] + v1[0]);
    g1[1] = f2[1] + v1[1]*(f1[1] + v1[1]);
    g1[2] = f2[2] + v1[2]*(f1[2] + v1[2]); // l^2
    vec3 g2;
    g2[0] = f2[0] + v2[0]*(f1[0] + v2[0]);
    g2[1] = f2[1] + v2[1]*(f1[1] + v2[1]);
    g2[2] = f2[2] + v2[2]*(f1[2] + v2[2]); // l^2

    sum_area += norm(d, 2)*0.5;            // l^2
    sum_1  += (d[0] * f1[0]) * (1 / 6.0);  // l^3
    sum_x  += (d[0] * f2[0]) * (1 / 24.0); // l^4
    sum_y  += (d[1] * f2[1]) * (1 / 24.0);
    sum_z  += (d[2] * f2[2]) * (1 / 24.0);
    sum_xx += (d[0] * f3[0]) * (1 / 60.0); // l^5
    sum_yy += (d[1] * f3[1]) * (1 / 60.0);
    sum_zz += (d[2] * f3[2]) * (1 / 60.0);
    sum_xy += (d[0] * (v0[1]*g0[0] + v1[1]*g1[0] + v2[1]*g2[0])) * (1 / 120.0); // l^5
    sum_yz += (d[1] * (v0[2]*g0[1] + v1[2]*g1[1] + v2[2]*g2[1])) * (1 / 120.0);
    sum_zx += (d[2] * (v0[0]*g0[2] + v1[0]*g1[2] + v2[0]*g2[2])) * (1 / 120.0);
  }

  if (0) printf("area=%g 1=%g x=%g y=%g z=%g xx=%g yy=%g zz=%g xy=%g yz=%g zx=%g\n",
                sum_area, sum_1, sum_x, sum_y, sum_z,
                sum_xx, sum_yy, sum_zz, sum_xy, sum_yz, sum_zx);

  double volume = sum_1;
  double mass = volume * density;
  return StlMassProperties(sum_1, mass, sum_area,
                           vec3 {sum_x/volume, sum_y/volume, sum_z/volume},
                           mat33 {+sum_yy + sum_zz,   -sum_xy,            -sum_zx,
                                  -sum_xy,            +sum_xx + sum_zz,   -sum_yz,
                                  -sum_zx,            -sum_yz,            +sum_xx + sum_yy} * density);
}


/*
  Used by remove_tiny faces, this is an auxilliary index to find & replace vertices.
*/
struct Vec3SpatialMap {

  Vec3SpatialMap(double maxScale)
  {
    eps = 0.000001;
    epssq = eps*eps;
    root = new OctreeNode(vec3 {0.0, 0.0, 0.0}, maxScale);
  }

  ~Vec3SpatialMap()
  {
    for (auto it : spatial) {
      delete it.second;
      it.second = nullptr;
    }
    spatial.clear();
    delete root;
  }

  Vec3SpatialMap(const Vec3SpatialMap &other) = delete;
  Vec3SpatialMap(Vec3SpatialMap &&other) = delete;
  Vec3SpatialMap & operator =(Vec3SpatialMap const &other) = delete;
  Vec3SpatialMap & operator =(Vec3SpatialMap &&other) = delete;

  vector<vec3 *> *findList(vec3 const &pt)
  {
    OctreeNode *node = root->lookup(pt, eps);
    vector<vec3 *> * &ent = spatial[node];
    if (!ent) {
      ent = new vector<vec3 *>;
    }
    return ent;
  }

  void addPt(vec3 *pt)
  {
    findList(*pt)->push_back(pt);
  }

  void replacePt(vec3 &search, vec3 &replace)
  {
    if (all(replace == search)) return;

    vector<vec3 *> *ptlist = findList(search);
    for (size_t iti=0; iti < ptlist->size(); iti++) {
      vec3 *it = (*ptlist)[iti];
      if (!it) continue;
      if (all(*it == replace)) continue;
      if (norm(*it - search, 2) < eps) {
        *it = replace;
        (*ptlist)[iti] = nullptr;
        addPt(it);
      }
    }
  }

  double eps;
  double epssq;
  OctreeNode *root;
  map<OctreeNode *, vector<vec3 *> *> spatial;
};

double StlSolid::getMaxScale() const
{
  return max(max(abs(bboxLo(0)),max(abs(bboxLo(1)),abs(bboxLo(2)))),
             max(abs(bboxHi(0)),max(abs(bboxHi(1)),abs(bboxHi(2)))));
}

/*
  This is a fairly primitive algorithm. Much better are known, but it's hard to find a convenient
  tool to do it.

  The algorithm collapses edges shorter than min_size by merging one of the points onto the other.
  A lot of faces in a row can cause pathological results, so we process the mesh in random order
*/
void StlSolid::removeTinyFaces(double minSize)
{
  Vec3SpatialMap spatial(getMaxScale());

  for (auto &f: faces) {
    spatial.addPt(&f.v0);
    spatial.addPt(&f.v1);
    spatial.addPt(&f.v2);
  }

  // Generate a random but deterministic order to process faces in
  vector<int> faceOrdering(faces.size());
  for (size_t fi=0; fi<faces.size(); fi++) {
    faceOrdering[fi] = fi;
  }
  uint32_t seed = faces.size() * 99 + 55;
  for (size_t fi=0; fi+1 < faces.size(); fi++) {
    size_t fi2 = seed % (faces.size() - fi) + fi;
    if (fi != fi2) {
      swap(faceOrdering[fi], faceOrdering[fi2]);
    }
    seed = (1103515245 * seed + 12345);
  }

  for (int passi=0; passi<3; passi++) {

    for (auto fiit : faceOrdering) {
      StlFace &f = faces[fiit];
      if (f.isDegenerate()) continue;

      if (norm(f.v1 - f.v0, 2) < minSize) {
        vec3 oldPt = f.v1;
        vec3 newPt = f.v0;
        spatial.replacePt(oldPt, newPt);
      }
      else if (norm(f.v2 - f.v0, 2) < minSize) {
        vec3 oldPt = f.v2;
        vec3 newPt = f.v0;
        spatial.replacePt(oldPt, newPt);
      }
      else if (norm(f.v2 - f.v1, 2) < minSize) {
        vec3 oldPt = f.v2;
        vec3 newPt = f.v1;
        spatial.replacePt(oldPt, newPt);
      }
    }
  }

  size_t origFaces = faces.size();

  auto fout = faces.begin();
  auto fin = faces.begin();
  auto fend = faces.end();

  while (fin != fend) {
    StlFace &f = *fin++;
    if (!f.isDegenerate()) {
      *fout++ = f;
    }
  }
  faces.erase(fout, fend);
  calcBbox();

  if (0) eprintf("remove_tiny_faces: %d => %d\n", (int)origFaces, (int)faces.size());
}


StlWebglMesh StlSolid::exportWebglMesh(double eps) const
{
  OctreeNode *root = new OctreeNode(vec3 {0.0, 0.0, 0.0}, getMaxScale());
  map<OctreeNode *, int> ptIndex;

  size_t nFaces = faces.size();
  StlWebglMesh ret;
  assert(nFaces < numeric_limits<size_t>::max()/9);
  ret.coords.resize(nFaces * 9);
  ret.normals.resize(nFaces * 9);
  ret.indexes.resize(nFaces * 3);
  size_t coordi = 0;
  size_t indexi = 0;

  map<string, S64> dupMap;

  auto pushVertex = [&](arma::vec3 const &position, arma::vec3 const &normal) {
    // Lame, but performance doesn't matter much here
    string dupKey = stringprintf("%.0f %.0f %.0f %.3f %.3f %.3f",
                                 position[0]/eps,
                                 position[1]/eps,
                                 position[2]/eps,
                                 normal[0],
                                 normal[1],
                                 normal[2]);

    // Store index+1 in dupMap, to distinguish zero as unassigned
    S64 &vi = dupMap[dupKey];
    if (!vi) {
      vi = coordi + 1;
      ret.coords[coordi*3 + 0] = position(0);
      ret.coords[coordi*3 + 1] = position(1);
      ret.coords[coordi*3 + 2] = position(2);
      ret.normals[coordi*3 + 0] = normal(0);
      ret.normals[coordi*3 + 1] = normal(1);
      ret.normals[coordi*3 + 2] = normal(2);
      coordi++;
    }
    ret.indexes[indexi] = vi - 1;
    indexi++;
  };

  for (auto const &f: faces) {
    pushVertex(f.v0, f.normal);
    pushVertex(f.v1, f.normal);
    pushVertex(f.v2, f.normal);
  }

  assert(coordi <= nFaces*3);
  assert(indexi <= nFaces*3);

  ret.coords.resize(coordi*3);
  ret.normals.resize(coordi*3);
  ret.indexes.resize(indexi);
  for (size_t i = 0; i < coordi; i++) {
    double mag = sqrt(sqr(ret.normals[i*3+0]) + sqr(ret.normals[i*3+1]) + sqr(ret.normals[i*3+2]));
    if (mag < 1e-6) continue;
    double scale = 1.0/mag;
    ret.normals[i*3+0] *= scale;
    ret.normals[i*3+1] *= scale;
    ret.normals[i*3+2] *= scale;
  }

  delete root;
  return ret;
}


/*
  Find the direction and location of a hole near the origin mostly aligned with the Z axis.
  If you need another direction, transform the StlSolid first.
*/

arma::vec3 StlSolid::analyzeHole(int axisi)
{
  const int itercount = 300;
  arma::vec3 fudge {0.001, 0.001, 0.001};
  arma::vec3 corner = bboxLo - fudge;
  arma::vec3 diagonal = bboxHi + fudge - corner;

  arma::vec3 avec(arma::fill::zeros);
  if (axisi == 0) {
    avec[0] = 1;
  }
  else if (axisi == 1) {
    avec[1] = 1;
  }
  else if (axisi == 2) {
    avec[2] = 1;
  }
  else {
    throw runtime_error("analyzeHole: bad axis");
  }

  if (0) eprintf("analyzeHole(%d) corner=%s diagonal=%s\n", axisi, asJson(corner).it.c_str(), asJson(diagonal).it.c_str());

  vector<arma::vec3> directions;

  for (int testi = 0; testi < itercount && directions.size() < 20; testi++) {
    /*
       Choose random points along the Z axis
       and a vector of unit length in a random direction in the XY plane.
    */

    double th = unipolarHaltonAxis(testi, 3) * (M_PI*2.0);
    double height = unipolarHaltonAxis(testi, 5);

    arma::vec3 pt(arma::fill::zeros);
    arma::vec3 d(arma::fill::zeros);
    if (axisi == 0) {
      pt[0] = corner[0] + height * diagonal[0];
      d[1] = cos(th);
      d[2] = sin(th);
    }
    else if (axisi == 1) {
      pt[1] = corner[1] + height * diagonal[1];
      d[0] = cos(th);
      d[2] = sin(th);
    }
    else if (axisi == 2) {
      pt[2] = corner[2] + height * diagonal[2];
      d[0] = cos(th);
      d[1] = sin(th);
    }
    else {
      throw runtime_error("analyzeHole: bad axis");
    }

    auto intersections = getIntersections(pt, d);
    for (size_t intersectioni=0; intersectioni < 2 && intersectioni < intersections.size(); intersectioni++) {
      auto intersection = intersections[intersectioni];
      if (intersection.face.getArea() > 0) {
        arma::vec3 si_pt = pt + d * intersection.t;
        arma::vec3 tangent = arma::normalise(arma::cross(avec, intersection.face.normal));
        arma::vec3 realaxis = arma::normalise(arma::cross(tangent, intersection.face.normal)) * -1;

        if (arma::dot(avec, realaxis) > 0.9) {
          directions.push_back(realaxis);
        }
      }
    }
  }

  if (directions.size() < 10) return arma::vec3 {0, 0, 0};

  sort(directions.begin(), directions.end(), [&](arma::vec3 const &a, arma::vec3 const &b) {
      return dot(avec, b) < dot(avec, a);
    });

  if (0) {
    for (auto ax : directions) {
      eprintf("sorted     +%0.3f +%0.3f %+0.3f\n", ax[0], ax[1], ax[2]);
    }
  }


  // Keep only best 70%
  directions.resize(directions.size() * 7 / 10);

  arma::vec3 avg_dir = accumulate(directions.begin(), directions.end(), arma::vec3 {0, 0, 0}) * (1.0/directions.size());

  return avg_dir;
}

/*
  Estimate the volume of the solid. We choose random points on the XY plane and calculate the section
  along the Z axis by ray casting.
*/
pair<double, arma::vec3>
StlSolid::estimateVolume()
{
  const int itercount = 300;
  arma::vec3 corner = bboxLo;
  arma::vec3 diagonal = bboxHi - corner;

  double volume_accum = 0.0;
  double volume_denom = 0.0;
  arma::vec3 center_accum(arma::fill::zeros);
  double center_denom = 0.0;


  for (int testi = 0; testi < itercount; testi++) {
    // Choose random points in the XY plane
    double hx = unipolarHaltonAxis(testi, 3);
    double hy = unipolarHaltonAxis(testi, 5);

    arma::vec3 pt { corner[0] + hx*diagonal[0], corner[1] + hy*diagonal[1], corner[2] };

    // and pointing to the other side. We want unit length so t == actual distance
    arma::vec3 d {0.0, 0.0, diagonal[2]/abs(diagonal[2])};

    auto intersections = getIntersections(pt, d);

    if (!intersections.empty()) {
      for (size_t ii=0; ii < intersections.size(); ii += 2) {
        double minz = intersections[ii].t + corner[2];
        double maxz = intersections[ii+1].t + corner[2];

        volume_accum += (maxz - minz);
        center_accum[0] += pt[0] * (maxz-minz);
        center_accum[1] += pt[1] * (maxz-minz);
        center_accum[2] += (maxz+minz)/2 * (maxz-minz);
        center_denom += maxz-minz;
      }
    }
    volume_denom += 1.0;
  }

  double volume = volume_accum * (diagonal[0] * diagonal[1]) / volume_denom;
  arma::vec3 center = center_accum / center_denom;

  return make_pair(volume, center);
}

// ----------------------------------------------------------------------

StlMassProperties::StlMassProperties()
  :cm(fill::zeros),
   inertiaOrigin(fill::zeros),
   inertiaCm(fill::zeros),
   rogOrigin(fill::zeros),
   rogCm(fill::zeros)
{
  calcDerived();
}

StlMassProperties::StlMassProperties(double _volume, double _mass, double _area, vec3 const &_cm, mat33 const &_inertiaOrigin)
  :volume(_volume),
   mass(_mass),
   area(_area),
   cm(_cm),
   inertiaOrigin(_inertiaOrigin),
   inertiaCm(fill::zeros),
   rogOrigin(fill::zeros),
   rogCm(fill::zeros)
{
  calcDerived();
}

void
StlMassProperties::calcDerived()
{
  if (volume==0.0 || mass==0.0) {
    density = 1.0;
    inertiaCm = mat33(fill::zeros);
    rogOrigin = vec3(fill::zeros);
    rogCm = vec3(fill::zeros);
  } else {
    density = mass / volume;
    inertiaCm = inertiaOrigin + mat33{ -(sqr(cm[1]) + sqr(cm[2])),  +cm[0] * cm[1],              +cm[2] * cm[0],
                                       +cm[0] * cm[1],              -(sqr(cm[2]) + sqr(cm[0])),  +cm[1] * cm[2],
                                       +cm[2] * cm[0],              +cm[1] * cm[2],              -(sqr(cm[0]) + sqr(cm[1]))} * mass;

    rogOrigin = inertiaOrigin.diag() / mass;
    rogCm = inertiaCm.diag() / mass;
  }
}

StlMassProperties operator +(StlMassProperties const &a, StlMassProperties const &b)
{
  return StlMassProperties(a.volume + b.volume,
                           a.mass + b.mass,
                           a.area,
                           (a.cm*a.mass + b.cm*b.mass) /(a.mass + b.mass),
                           a.inertiaOrigin + b.inertiaOrigin);
}

StlMassProperties StlMassProperties::multiplyDensity(double factor)
{
  return StlMassProperties(volume,
                           mass * factor,
                           area,
                           cm,
                           inertiaOrigin * factor);
}


ostream & operator << (ostream &s, StlMassProperties const &it)
{
  s << "StlMassProperties(volume=" << it.volume << ", mass=" << it.mass << ", area=" << it.area << ", cm=\n" << it.cm << ", inertiaOrigin=\n" << it.inertiaOrigin << ")";
  return s;
}

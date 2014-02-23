#include "../common/std_headers.h"
#include "./solid_geometry.h"


octree_node::octree_node(Vec3 const &_center, float _scale)
  :center(_center), scale(_scale)
{
  for (int i=0; i<8; i++) children[i] = NULL;
}

octree_node::~octree_node()
{
  for (int i=0; i<8; i++) delete children[i];
}

octree_node *octree_node::lookup(Vec3 const &pt, float max_scale)
{
  if (scale < max_scale) return this;
  int index = (((pt.x >= center.x) ? 4:0) |
               ((pt.y >= center.y) ? 2:0) |
               ((pt.z >= center.z) ? 1:0));
  if (!children[index]) {
    children[index] = new octree_node(Vec3(center.x + scale * ((index&4) ? +0.5 : -0.5),
                                           center.y + scale * ((index&2) ? +0.5 : -0.5),
                                           center.z + scale * ((index&1) ? +0.5 : -0.5)), scale*0.5);
  }
  return children[index]->lookup(pt, max_scale);
}


/* Simple reader for STL files. Only handles binary.
   See http://en.wikipedia.org/wiki/STL_(file_format)
*/

stl_face::stl_face()
{
}

stl_face::stl_face(Vec3 _v0, Vec3 _v1, Vec3 _v2)
  :v0(_v0),
   v1(_v1),
   v2(_v2)
{
  calc_normal();
}


stl_face::stl_face(Vec3 _v0, Vec3 _v1, Vec3 _v2, Vec3 _normal)
  :v0(_v0),
   v1(_v1),
   v2(_v2),
   normal(normalize(_normal))
{
  if (0) {
    Vec3 cpnorm = normalize(cross(v1-v0, v2-v0));
    float dp = dot(normal, cpnorm);
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
  }
}

stl_face::~stl_face()
{
}

void stl_face::calc_normal()
{
  Vec3 cp = cross(v1-v0, v2-v0);

  if (norm(cp) == 0.0) {
    normal = Vec3(0.0, 0.0, 0.0);
  } else {
    normal = normalize(cp);
  }
}

// Test whether the vector starting at p and of length/direction d intersects me
#if 0
bool
stl_face::ray_intersects(Vec3 const &p, Vec3 const &d, float &t) const
{
  Vec3 e1 = v1-v0;
  Vec3 e2 = v2-v0;

  Vec3 h = cross(d, e2);
  float a = dot(e1, h);
  if (fabs(a)<1e-10) return false;

  float f=1.0/a;
  
  Vec3 s=p-v0;
  float u = f * dot(s, h);
  if (u<0.0 || u>1.0) return false;
  
  Vec3 q = cross(s, e1);
  float v = f * dot(d, q);
  if (v<0.0 || u+v>1.0) return false;
  
  t = f * dot(e2, q);
  if (t < 1e-10) return false;

  return true;
}
#else
// Special fast version since we do a lot of this
bool
stl_face::ray_intersects(Vec3 const &p, Vec3 const &d, float &t) const
{
  float e1_x = v1.x-v0.x; 
  float e1_y = v1.y-v0.y;
  float e1_z = v1.z-v0.z;
  float e2_x = v2.x-v0.x; 
  float e2_y = v2.y-v0.y;
  float e2_z = v2.z-v0.z;

  float h_x = d.y*e2_z - d.z*e2_y;
  float h_y = d.z*e2_x - d.x*e2_z;
  float h_z = d.x*e2_y - d.y*e2_x;

  float a = e1_x*h_x + e1_y*h_y + e1_z*h_z;
  if (a<1e-10 && a>-1e-10) return false;

  float f=1.0/a;

  float s_x = p.x - v0.x;
  float s_y = p.y - v0.y;
  float s_z = p.z - v0.z;

  float u = f*s_x*h_x + f*s_y*h_y + f*s_z*h_z;
  if (u<0.0 || u>1.0) return false;

  float q_x = s_y*e1_z - s_z*e1_y;
  float q_y = s_z*e1_x - s_x*e1_z;
  float q_z = s_x*e1_y - s_y*e1_x;

  float v = f*d.x*q_x + f*d.y*q_y + f*d.z*q_z;
  if (v<0.0 || u+v>1.0) return false;
  
  t = f*e2_x*q_x + f*e2_y*q_y + f*e2_z*q_z;
  if (t < 1e-10) return false;

  return true;
}
#endif

void
stl_face::transform(Mat44 const &m)
{
  v0 = m * v0;
  v1 = m * v1;
  v2 = m * v2;

  normal = justRotation(m) * normal;
}

float
stl_face::get_area() const
{
  Vec3 e1 = v1-v0;
  Vec3 e2 = v2-v0;

  return norm(cross(e1, e2))*0.5;
}

Vec3
stl_face::get_e1() const
{
  return v1-v0;
}

Vec3
stl_face::get_e2() const
{
  return v2-v0;
}

bool stl_face::is_degenerate() const
{
  return (v0 == v1 || v2 == v1 || v0 == v2);
}

Vec3 stl_face::centroid() const
{
  return (v0 + v1 + v2) * (1.0/3.0);
}

bool operator == (stl_face const &a, stl_face const &b)
{
  return (a.normal==b.normal && 
          a.v0 == b.v0 &&
          a.v1 == b.v1 &&
          a.v2 == b.v2);
}

/* ----------------------------------------------------------------------
   Packet IO
*/

void packet_rd_value(packet &p, stl_face &it)
{
  packet_rd_value(p, it.v0);
  packet_rd_value(p, it.v1);
  packet_rd_value(p, it.v2);
}
void packet_wr_value(packet &p, stl_face const &it)
{
  packet_wr_value(p, it.v0);
  packet_wr_value(p, it.v1);
  packet_wr_value(p, it.v2);
}
void packet_rd_typetag(packet &p, stl_face &it)
{
  p.check_typetag("stl_face:1");
}
void packet_wr_typetag(packet &p, stl_face const &it)
{
  p.add_typetag("stl_face:1");
}


// ----------------------------------------------------------------------

stl_solid::stl_solid()
{
}

stl_solid::~stl_solid()
{
}

void
stl_solid::read_binary_file(FILE *fp, double scale)
{
  char dummyline[80];
  if (fread(dummyline, 1, 80, fp)!=80) throw runtime_error("reading header");

  int n_triangles=0;
  if (fread(&n_triangles, sizeof(int), 1, fp)!=1) throw runtime_error("reading n_triangles");

  faces.reserve(n_triangles);
  
  for (int ti=0; ti<n_triangles; ti++) {

    float data[12];
    if (fread(&data, sizeof(float), 12, fp) != 12) throw runtime_error("reading 12 floats");
    
    stl_face face(Vec3(data[3] * scale, data[4] * scale, data[5] * scale),
                  Vec3(data[6] * scale, data[7] * scale, data[8] * scale),
                  Vec3(data[9] * scale, data[10]* scale, data[11] * scale),
                  Vec3(data[0], data[1], data[2]));
    
    short attr_byte_count=0;
    if (fread(&attr_byte_count, sizeof(short), 1, fp)!=1) throw runtime_error("reading attr_byte_count");

    if (attr_byte_count!=0) throw runtime_error("bad attr_byte_count");

    faces.push_back(face);

  }
  calc_bbox();

  if (0) eprintf("Read %d faces\n", n_triangles);
}

void packet_rd_value(packet &p, stl_solid &it)
{
  packet_rd_value(p, it.bbox_lo);
  packet_rd_value(p, it.bbox_hi);
  packet_rd_value(p, it.faces);
}
void packet_wr_value(packet &p, stl_solid const &it)
{
  packet_wr_value(p, it.bbox_lo);
  packet_wr_value(p, it.bbox_hi);
  packet_wr_value(p, it.faces);
}
void packet_rd_typetag(packet &p, stl_solid &it)
{
  p.check_typetag("stl_solid:1");
  packet_rd_typetag(p, it.bbox_lo);
  packet_rd_typetag(p, it.bbox_hi);
  packet_rd_typetag(p, it.faces);
}
void packet_wr_typetag(packet &p, stl_solid const &it)
{
  p.add_typetag("stl_solid:1");
  packet_wr_typetag(p, it.bbox_lo);
  packet_wr_typetag(p, it.bbox_hi);
  packet_wr_typetag(p, it.faces);
}


void
stl_solid::transform(Mat44 const &m)
{
  for (vector<stl_face>::iterator it = faces.begin(); it != faces.end(); ++it) {
    stl_face &face = *it;
    face.transform(m);
  }
  calc_bbox();
}


void
stl_solid::calc_bbox()
{
  if (faces.size()==0) {
    bbox_lo = bbox_hi = Vec3::allZero();
    return;
  }

  Vec3 lo = faces[0].v0;
  Vec3 hi = faces[0].v0;

  for (vector<stl_face>::iterator it = faces.begin(); it != faces.end(); ++it) {
    stl_face &face = *it;
    
    lo.x = min(lo.x, face.v0.x);
    lo.y = min(lo.y, face.v0.y);
    lo.z = min(lo.z, face.v0.z);
    lo.x = min(lo.x, face.v1.x);
    lo.y = min(lo.y, face.v1.y);
    lo.z = min(lo.z, face.v1.z);
    lo.x = min(lo.x, face.v2.x);
    lo.y = min(lo.y, face.v2.y);
    lo.z = min(lo.z, face.v2.z);
    
    hi.x = max(hi.x, face.v0.x);
    hi.y = max(hi.y, face.v0.y);
    hi.z = max(hi.z, face.v0.z);
    hi.x = max(hi.x, face.v1.x);
    hi.y = max(hi.y, face.v1.y);
    hi.z = max(hi.z, face.v1.z);
    hi.x = max(hi.x, face.v2.x);
    hi.y = max(hi.y, face.v2.y);
    hi.z = max(hi.z, face.v2.z);
    
  }
  bbox_lo = lo;
  bbox_hi = hi;
}

bool
stl_solid::ray_intersects(Vec3 const &p, Vec3 const &d) const
{
  for (vector<stl_face>::const_iterator it = faces.begin(); it != faces.end(); ++it) {
    stl_face const &face = *it;
    float t;
    if (face.ray_intersects(p, d, t)) {
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
stl_solid::is_interior(Vec3 const &pt) const
{
  bool ret = false;
  Vec3 dir(1, 0, 0);

  for (vector<stl_face>::const_iterator it = faces.begin(); it != faces.end(); ++it) {
    stl_face const &face = *it;
    float t;
    if (face.ray_intersects(pt, dir, t)) {
      ret = !ret;
    }
  }
  return ret;
}

bool operator < (stl_intersection const &a, stl_intersection const &b)
{
  return a.t < b.t;
}

vector<stl_intersection>
stl_solid::intersection_list(Vec3 const &p, Vec3 const &d) const
{
  vector<stl_intersection> ret;
  
  for (vector<stl_face>::const_iterator it = faces.begin(); it != faces.end(); ++it) {
    stl_face const &face = *it;
    float t;
    if (face.ray_intersects(p, d, t)) {
      stl_intersection si;
      si.face = face;
      si.t = t;
      ret.push_back(si);
    }
  }

  if (ret.size() % 2) {
    // If an odd number, we must have started inside so add fake face
    stl_intersection si;
    si.face.normal = normalize(d * -1.0); // points opposite to d
    si.face.v0=si.face.v1=si.face.v2=Vec3(0,0,0);
    si.t = 0.0;
    ret.push_back(si);
  }

  sort(ret.begin(), ret.end());

  return ret;
}

mass_properties
stl_solid::get_mass_properties(double density)
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
    
  for (vector<stl_face>::const_iterator it = faces.begin(); it != faces.end(); ++it) {
    stl_face const &f = *it;
        
    Vec3 v0 = f.v0;
    Vec3 v1 = f.v1;
    Vec3 v2 = f.v2;
    Vec3 e1 = v1-v0;
    Vec3 e2 = v2-v0;

    Vec3 d = cross(e1, e2);   // l^2

    Vec3 f1 = v0 + v1 + v2;   // l^1

    Vec3 f2(sqr(v0.x) + v0.x*v1.x + sqr(v1.x) + v2.x*f1.x,
            sqr(v0.y) + v0.y*v1.y + sqr(v1.y) + v2.y*f1.y,
            sqr(v0.z) + v0.z*v1.z + sqr(v1.z) + v2.z*f1.z); // l^2
                  
    Vec3 f3(pow(v0.x, 3) + sqr(v0.x)*v1.x + v0.x*sqr(v1.x) + pow(v1.x, 3) + v2.x*f2.x,
            pow(v0.y, 3) + sqr(v0.y)*v1.y + v0.y*sqr(v1.y) + pow(v1.y, 3) + v2.y*f2.y,
            pow(v0.z, 3) + sqr(v0.z)*v1.z + v0.z*sqr(v1.z) + pow(v1.z, 3) + v2.z*f2.z); // l^3

    Vec3 g0(f2.x + v0.x*(f1.x + v0.x),
            f2.y + v0.y*(f1.y + v0.y),
            f2.z + v0.z*(f1.z + v0.z)); // l^2
    Vec3 g1(f2.x + v1.x*(f1.x + v1.x),
            f2.y + v1.y*(f1.y + v1.y),
            f2.z + v1.z*(f1.z + v1.z)); // l^2
    Vec3 g2(f2.x + v2.x*(f1.x + v2.x),
            f2.y + v2.y*(f1.y + v2.y),
            f2.z + v2.z*(f1.z + v2.z)); // l^2
    
    sum_area += norm(d)*0.5;            // l^2
    sum_1  += (d.x * f1.x) * (1 / 6.0);  // l^3
    sum_x  += (d.x * f2.x) * (1 / 24.0); // l^4
    sum_y  += (d.y * f2.y) * (1 / 24.0);
    sum_z  += (d.z * f2.z) * (1 / 24.0);
    sum_xx += (d.x * f3.x) * (1 / 60.0); // l^5
    sum_yy += (d.y * f3.y) * (1 / 60.0);
    sum_zz += (d.z * f3.z) * (1 / 60.0);
    sum_xy += (d.x * (v0.y*g0.x + v1.y*g1.x + v2.y*g2.x)) * (1 / 120.0); // l^5
    sum_yz += (d.y * (v0.z*g0.y + v1.z*g1.y + v2.z*g2.y)) * (1 / 120.0);
    sum_zx += (d.z * (v0.x*g0.z + v1.x*g1.z + v2.x*g2.z)) * (1 / 120.0);
  }

  if (0) printf("area=%g 1=%g x=%g y=%g z=%g xx=%g yy=%g zz=%g xy=%g yz=%g zx=%g\n",
                sum_area, sum_1, sum_x, sum_y, sum_z,
                sum_xx, sum_yy, sum_zz, sum_xy, sum_yz, sum_zx);

  double volume = sum_1;
  double mass = volume * density;
  return mass_properties(sum_1, mass, sum_area,
                         Vec3(sum_x/volume, sum_y/volume, sum_z/volume),
                         Mat33(+sum_yy + sum_zz,   -sum_xy,            -sum_zx,
                               -sum_xy,            +sum_xx + sum_zz,   -sum_yz,
                               -sum_zx,            -sum_yz,            +sum_xx + sum_yy) * density);
}


/*
  Used by remove_tiny faces, this is an auxilliary index to find & replace vertices.
*/
struct Vec3_spatial_map {

  Vec3_spatial_map() 
  {
    eps = 0.000001;
    epssq = eps*eps;
    root = new octree_node(Vec3(0.0, 0.0, 0.0), 4.0);
  }
  
  ~Vec3_spatial_map()
  {
    for (map<octree_node *, vector<Vec3*>*>::iterator it = spatial.begin(); it != spatial.end(); ++it) {
      delete it->second;
    }
    spatial.clear();
    delete root;
  }

  vector<Vec3 *> *find_list(Vec3 const &pt)
  {
    octree_node *node = root->lookup(pt, eps);
    vector<Vec3 *> * &ent = spatial[node];
    if (!ent) {
      ent = new vector<Vec3 *>;
    }
    return ent;
  }

  void add_pt(Vec3 *pt)
  {
    find_list(*pt)->push_back(pt);
  }

  void replace_pt(Vec3 &search, Vec3 &replace)
  {
    if (replace == search) return;

    vector<Vec3 *> *ptlist = find_list(search);
    for (size_t iti=0; iti < ptlist->size(); iti++) {
      Vec3 *it = (*ptlist)[iti];
      if (!it) continue;
      if (*it == replace) continue;
      if (normsq(*it - search) < epssq) {
        *it = replace;
        (*ptlist)[iti] = NULL;
        add_pt(it);
      }
    }
  }
  
  float eps;
  float epssq;
  octree_node *root;
  map<octree_node *, vector<Vec3 *> *> spatial;
};

/*
  This is a fairly primitive algorithm. Much better are known, but it's hard to find a convenient
  tool to do it.

  The algorithm collapses edges shorter than min_size by merging one of the points onto the other.
  A lot of faces in a row can cause pathological results, so we process the mesh in random order
*/
void stl_solid::remove_tiny_faces(float min_size)
{
  Vec3_spatial_map spatial;

  for (size_t fi=0; fi<faces.size(); fi++) {
    stl_face &f = faces[fi];
    spatial.add_pt(&f.v0);
    spatial.add_pt(&f.v1);
    spatial.add_pt(&f.v2);
  }

  // Generate a random but deterministic order to process faces in
  vector<int> face_ordering(faces.size());
  for (size_t fi=0; fi<faces.size(); fi++) {
    face_ordering[fi] = fi;
  }
  size_t seed = faces.size() * 99 + 55;
  for (size_t fi=0; fi<faces.size(); fi++) {
    size_t fi2 = seed % (faces.size() - fi) + fi;
    swap(face_ordering[fi], face_ordering[fi2]);
    seed = (1103515245 * seed + 12345);
  }
  
  for (int passi=0; passi<3; passi++) {
    
    vector<int>::iterator fiit;
    for (fiit = face_ordering.begin(); fiit != face_ordering.end(); ++fiit) {
      stl_face &f = faces[*fiit];
      if (f.is_degenerate()) continue;

      if (norm(f.v1 - f.v0) < min_size) {
        Vec3 old_pt = f.v1;
        Vec3 new_pt = f.v0;
        spatial.replace_pt(old_pt, new_pt);
      }
      else if (norm(f.v2 - f.v0) < min_size) {
        Vec3 old_pt = f.v2;
        Vec3 new_pt = f.v0;
        spatial.replace_pt(old_pt, new_pt);
      }
      else if (norm(f.v2 - f.v1) < min_size) {
        Vec3 old_pt = f.v2;
        Vec3 new_pt = f.v1;
        spatial.replace_pt(old_pt, new_pt);
      }
    }
  }

  size_t orig_faces = faces.size();

  vector<stl_face>::iterator fout = faces.begin();
  vector<stl_face>::iterator fin = faces.begin();
  vector<stl_face>::iterator fend = faces.end();

  while (fin != fend) {
    stl_face &f = *fin++;
    if (!f.is_degenerate()) {
      *fout++ = f;
    }
  }
  faces.erase(fout, fend);

  if (0) eprintf("remove_tiny_faces: %d => %d\n", (int)orig_faces, (int)faces.size());
}


// ----------------------------------------------------------------------

mass_properties::mass_properties(double _volume, double _mass, double _area, Vec3 _cm, Mat33 _inertia_origin)
  :volume(_volume),
   mass(_mass),
   area(_area),
   cm(_cm),
   inertia_origin(_inertia_origin)
{
  calc_derived();
}

mass_properties mass_properties::allZero()
{
  return mass_properties(0.0, 0.0, 0.0, Vec3::allZero(), Mat33::allZero());
}

void packet_rd_value(packet &p, mass_properties &it)
{
  p.get(it.density);
  p.get(it.volume);
  p.get(it.mass);
  p.get(it.area);
  p.get(it.cm);
  p.get(it.inertia_origin);
  p.get(it.inertia_cm);
  p.get(it.rog_origin);
  p.get(it.rog_cm);
}
void packet_wr_value(packet &p, mass_properties const &it)
{
  p.add(it.density);
  p.add(it.volume);
  p.add(it.mass);
  p.add(it.area);
  p.add(it.cm);
  p.add(it.inertia_origin);
  p.add(it.inertia_cm);
  p.add(it.rog_origin);
  p.add(it.rog_cm);
}

void packet_rd_typetag(packet &p, mass_properties &it)
{
  p.check_typetag("mass_properties:1");
  packet_rd_typetag(p, it.density);
  packet_rd_typetag(p, it.volume);
  packet_rd_typetag(p, it.mass);
  packet_rd_typetag(p, it.area);
  packet_rd_typetag(p, it.cm);
  packet_rd_typetag(p, it.inertia_origin);
  packet_rd_typetag(p, it.inertia_cm);
  packet_rd_typetag(p, it.rog_origin);
  packet_rd_typetag(p, it.rog_cm);
}

void packet_wr_typetag(packet &p, mass_properties const &it) 
{
  p.add_typetag("mass_properties:1");
  packet_wr_typetag(p, it.density);
  packet_wr_typetag(p, it.volume);
  packet_wr_typetag(p, it.mass);
  packet_wr_typetag(p, it.area);
  packet_wr_typetag(p, it.cm);
  packet_wr_typetag(p, it.inertia_origin);
  packet_wr_typetag(p, it.inertia_cm);
  packet_wr_typetag(p, it.rog_origin);
  packet_wr_typetag(p, it.rog_cm);
}

void
mass_properties::calc_derived()
{
  if (volume==0.0 || mass==0.0) {
    density = 1.0;
    inertia_cm = Mat33::allZero();
    rog_origin = Vec3::allZero();
    rog_cm = Vec3::allZero();
  } else {
    density = mass / volume;
    inertia_cm = inertia_origin + Mat33(-(sqr(cm.y) + sqr(cm.z)),  +cm.x * cm.y,              +cm.z * cm.x,
                                        +cm.x * cm.y,              -(sqr(cm.z) + sqr(cm.x)),  +cm.y * cm.z,
                                        +cm.z * cm.x,              +cm.y * cm.z,              -(sqr(cm.x) + sqr(cm.y))) * mass;

    rog_origin = Vec3(sqrt(inertia_origin.xx / mass),
                      sqrt(inertia_origin.yy / mass),
                      sqrt(inertia_origin.zz / mass));
  
    rog_cm = Vec3(sqrt(inertia_cm.xx / mass),
                  sqrt(inertia_cm.yy / mass),
                  sqrt(inertia_cm.zz / mass));
  }
}

mass_properties operator +(mass_properties const &a, mass_properties const &b)
{
  return mass_properties(a.volume + b.volume, 
                         a.mass + b.mass,
                         a.area,
                         (a.cm*a.mass + b.cm*b.mass) * (1.0/(a.mass+b.mass)),
                         a.inertia_origin + b.inertia_origin);
}

mass_properties mass_properties::multiply_density(double factor)
{
  return mass_properties(volume,
                         mass * factor,
                         area,
                         cm,
                         inertia_origin * factor);
}


ostream & operator << (ostream &s, mass_properties const &it)
{
  s << "mass_properties(volume=" << it.volume << ", mass=" << it.mass << ", area=" << it.area << ", cm=" << it.cm << ", inertia_origin=" << it.inertia_origin << ")";
  return s;
}

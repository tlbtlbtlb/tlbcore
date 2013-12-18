#include "../common/std_headers.h"
#include "./geom_math.h"

#define nan (numeric_limits<double>::quiet_NaN())

double sqr(double x) {
  return x*x;
}

double limit(double v, double lo, double hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

Vec2 operator +(Vec2 const &u, Vec2 const &v)
{
  return Vec2(u.x + v.x, u.y + v.y);
}
Vec3 operator +(Vec3 const &u, Vec3 const &v)
{
  return Vec3(u.x + v.x, u.y + v.y, u.z + v.z);
}
Vec4 operator +(Vec4 const &u, Vec4 const &v)
{
  return Vec4(u.x + v.x, u.y + v.y, u.z + v.z, u.a + v.a);
}

Vec2 operator -(Vec2 const &u, Vec2 const &v)
{
  return Vec2(u.x - v.x, u.y - v.y);
}
Vec3 operator -(Vec3 const &u, Vec3 const &v)
{
  return Vec3(u.x - v.x, u.y - v.y, u.z - v.z);
}
Vec4 operator -(Vec4 const &u, Vec4 const &v)
{
  return Vec4(u.x - v.x, u.y - v.y, u.z - v.z, u.a - v.a);
}

Mat22 operator +(Mat22 const &u, Mat22 const &v)
{
  return Mat22(u.xx + v.xx, u.xy + v.xy,
               u.yx + v.yx, u.yy + v.yy);
}
Mat33 operator +(Mat33 const &u, Mat33 const &v)
{
  return Mat33(u.xx + v.xx, u.xy + v.xy, u.xz + v.xz,
               u.yx + v.yx, u.yy + v.yy, u.yz + v.yz,
               u.zx + v.zx, u.zy + v.zy, u.zz + v.zz);
}
Mat44 operator +(Mat44 const &u, Mat44 const &v)
{
  return Mat44(u.xx + v.xx, u.xy + v.xy, u.xz + v.xz, u.xa + v.xa,
               u.yx + v.yx, u.yy + v.yy, u.yz + v.yz, u.ya + v.ya,
               u.zx + v.zx, u.zy + v.zy, u.zz + v.zz, u.za + v.za,
               u.ax + v.ax, u.ay + v.ay, u.az + v.az, u.aa + v.aa);
}

Mat22 operator -(Mat22 const &u, Mat22 const &v)
{
  return Mat22(u.xx - v.xx, u.xy - v.xy,
               u.yx - v.yx, u.yy - v.yy);
}
Mat33 operator -(Mat33 const &u, Mat33 const &v)
{
  return Mat33(u.xx - v.xx, u.xy - v.xy, u.xz - v.xz,
               u.yx - v.yx, u.yy - v.yy, u.yz - v.yz,
               u.zx - v.zx, u.zy - v.zy, u.zz - v.zz);
}
Mat44 operator -(Mat44 const &u, Mat44 const &v)
{
  return Mat44(u.xx - v.xx, u.xy - v.xy, u.xz - v.xz, u.xa - v.xa,
               u.yx - v.yx, u.yy - v.yy, u.yz - v.yz, u.ya - v.ya,
               u.zx - v.zx, u.zy - v.zy, u.zz - v.zz, u.za - v.za,
               u.ax - v.ax, u.ay - v.ay, u.az - v.az, u.aa - v.aa);
}


bool operator ==(Vec2 const &u, Vec2 const &v)
{
  return (u.x == v.x && u.y == v.y);
}
bool operator ==(Vec3 const &u, Vec3 const &v)
{
  return (u.x == v.x && u.y == v.y && u.z == v.z);
}
bool operator ==(Vec4 const &u, Vec4 const &v)
{
  return (u.x == v.x && u.y == v.y && u.z == v.z && u.a == v.a);
}
bool operator ==(Mat22 const &u, Mat22 const &v)
{
  return (u.xx == v.xx && u.xy == v.xy &&
          u.yx == v.yx && u.yy == v.yy);
}
bool operator ==(Mat33 const &u, Mat33 const &v)
{
  return (u.xx == v.xx && u.xy == v.xy && u.xz == v.xz &&
          u.yx == v.yx && u.yy == v.yy && u.yz == v.yz &&
          u.zx == v.zx && u.zy == v.zy && u.zz == v.zz);
}
bool operator ==(Mat44 const &u, Mat44 const &v)
{
  return (u.xx == v.xx && u.xy == v.xy && u.xz == v.xz && u.xa == v.xa &&
          u.yx == v.yx && u.yy == v.yy && u.yz == v.yz && u.ya == v.ya &&
          u.zx == v.zx && u.zy == v.zy && u.zz == v.zz && u.za == v.za &&
          u.ax == v.ax && u.ay == v.ay && u.az == v.az && u.aa == v.aa);
}

#if 0
double operator *(double u, double v)
{
  return u * v;
}
#endif

Vec2 operator *(Vec2 const &u, double v)
{
  return Vec2(u.x * v, u.y * v);
}

Vec3 operator *(Vec3 const &u, double v)
{
  return Vec3(u.x * v, u.y * v, u.z * v);
}

Vec4 operator *(Vec4 const &u, double v)
{
  return Vec4(u.x * v, u.y * v, u.z * v, u.a * v);
}


Mat22 operator *(Mat22 const &u, Mat22 const &v)
{
  return Mat22(u.xx*v.xx + u.xy*v.yx, u.xx*v.xy + u.xy*v.yy,
               u.yx*v.xx + u.yy*v.yx, u.yx*v.xy + u.yy*v.yy);
}

Mat33 operator *(Mat33 const &u, Mat33 const &v)
{
  return Mat33(u.xx*v.xx + u.xy*v.yx + u.xz*v.zx, u.xx*v.xy + u.xy*v.yy + u.xz*v.zy, u.xx*v.xz + u.xy*v.yz + u.xz*v.zz,
               u.yx*v.xx + u.yy*v.yx + u.yz*v.zx, u.yx*v.xy + u.yy*v.yy + u.yz*v.zy, u.yx*v.xz + u.yy*v.yz + u.yz*v.zz,
               u.zx*v.xx + u.zy*v.yx + u.zz*v.zx, u.zx*v.xy + u.zy*v.yy + u.zz*v.zy, u.zx*v.xz + u.zy*v.yz + u.zz*v.zz);
}

Mat44 operator *(Mat44 const &u, Mat44 const &v)
{
  return Mat44(u.xx*v.xx + u.xy*v.yx + u.xz*v.zx + u.xa*v.ax, 
               u.xx*v.xy + u.xy*v.yy + u.xz*v.zy + u.xa*v.ay, 
               u.xx*v.xz + u.xy*v.yz + u.xz*v.zz + u.xa*v.az,
               u.xx*v.xa + u.xy*v.ya + u.xz*v.za + u.xa*v.aa,
               
               u.yx*v.xx + u.yy*v.yx + u.yz*v.zx + u.ya*v.ax, 
               u.yx*v.xy + u.yy*v.yy + u.yz*v.zy + u.ya*v.ay, 
               u.yx*v.xz + u.yy*v.yz + u.yz*v.zz + u.ya*v.az,
               u.yx*v.xa + u.yy*v.ya + u.yz*v.za + u.ya*v.aa,
               
               u.zx*v.xx + u.zy*v.yx + u.zz*v.zx + u.za*v.ax, 
               u.zx*v.xy + u.zy*v.yy + u.zz*v.zy + u.za*v.ay, 
               u.zx*v.xz + u.zy*v.yz + u.zz*v.zz + u.za*v.az,
               u.zx*v.xa + u.zy*v.ya + u.zz*v.za + u.za*v.aa,
               
               u.ax*v.xx + u.ay*v.yx + u.az*v.zx + u.aa*v.ax, 
               u.ax*v.xy + u.ay*v.yy + u.az*v.zy + u.aa*v.ay, 
               u.ax*v.xz + u.ay*v.yz + u.az*v.zz + u.aa*v.az,
               u.ax*v.xa + u.ay*v.ya + u.az*v.za + u.aa*v.aa);
}


Vec2 operator *(Mat22 const &m, const Vec2 &v)
{
  return Vec2(m.xx*v.x + m.xy*v.y,
                 m.yx*v.x + m.yy*v.y);
}

Vec3 operator *(Mat33 const &m, Vec3 const &v)
{
  return Vec3(m.xx*v.x + m.xy*v.y + m.xz*v.z,
              m.yx*v.x + m.yy*v.y + m.yz*v.z,
              m.zx*v.x + m.zy*v.y + m.zz*v.z);
}

Vec3 operator *(Mat44 const &m, Vec3 const &v)
{
  return fromHomo(operator *(m, Vec4(v.x, v.y, v.z, 1.0)));
}

Vec4 operator *(Mat44 const &m, Vec4 const &v)
{
  return Vec4(m.xx*v.x + m.xy*v.y + m.xz*v.z + m.xa*v.a,
              m.yx*v.x + m.yy*v.y + m.yz*v.z + m.ya*v.a,
              m.zx*v.x + m.zy*v.y + m.zz*v.z + m.za*v.a,
              m.ax*v.x + m.ay*v.y + m.az*v.z + m.aa*v.a);
}

Quaternion grassmanProduct(const Quaternion &u, const Quaternion &v)
{
  return Quaternion(u.a*v.a - u.b*v.b - u.c*v.c - u.d*v.d,
                    u.a*v.b + u.b*v.a + u.c*v.d - u.d*v.c,
                    u.a*v.c - u.b*v.d + u.c*v.a + u.d*v.b,
                    u.a*v.d + u.b*v.c - u.c*v.b + u.d*v.a);
}

// ----------------------------------------------------------------------

double dot(const Vec2 &u, const Vec2 &v)
{
  return u.x*v.x + u.y*v.y;
}

double dot(Vec3 const &u, Vec3 const &v)
{
  return u.x*v.x + u.y*v.y + u.z*v.z;
}

double dot(Vec4 const &u, Vec4 const &v)
{
  return u.x*v.x + u.y*v.y + u.z*v.z + u.a*v.a;
}

// ----------------------------------------------------------------------

Vec3 fromHomo(Vec4 const &u)
{
  return Vec3(u.x/u.a, u.y/u.a, u.z/u.a);
}

Vec4 toHomo(Vec3 const &u)
{
  return Vec4(u.x, u.y, u.z, 1.0);
}

Mat44 toHomo(Mat33 const &u)
{
  return Mat44(u.xx,  u.xy,  u.xz,  0.0,
               u.yx,  u.yy,  u.yz,  0.0,
               u.zx,  u.zy,  u.zz,  0.0,
               0.0, 0.0, 0.0, 1.0);
}

Mat33 toHomo(Mat22 const &u)
{
  return Mat33(u.xx,  u.xy,  0.0,
               u.yx,  u.yy,  0.0,
               0.0, 0.0, 1.0);
}

Mat33 fromHomo(Mat44 const &u)
{
  if (u.xa!=0.0 || u.ya!=0.0 || u.za!=0.0 || u.ax!=0.0 || u.ay!=0.0 || u.az!=0.0 || u.aa!=1.0) {
    die("fromHomo(Mat4): not in standard homogenous form.");
  }
  return Mat33(u.xx,  u.xy,  u.xz,
               u.yx,  u.yy,  u.yz,
               u.zx,  u.zy,  u.zz);
}

// ----------------------------------------------------------------------

double determinant(Mat22 const &u)
{
  return(u.xx * u.yy - u.xy * u.yx);
}

double determinant(Mat33 const &u)
{
  return(u.xx * (u.yy * u.zz - u.yz * u.zy) +
         u.xy * (u.yz * u.zx - u.yx * u.zz) +
         u.xz * (u.yx * u.zy - u.yy * u.zx));
}

double determinant(Mat44 const &u)
{
  return (+u.xa*u.yz*u.zy*u.ax  -  u.xz*u.ya*u.zy*u.ax  -  u.xa*u.yy*u.zz*u.ax  +  u.xy*u.ya*u.zz*u.ax
          +u.xz*u.yy*u.za*u.ax  -  u.xy*u.yz*u.za*u.ax  -  u.xa*u.yz*u.zx*u.ay  +  u.xz*u.ya*u.zx*u.ay
          +u.xa*u.yx*u.zz*u.ay  -  u.xx*u.ya*u.zz*u.ay  -  u.xz*u.yx*u.za*u.ay  +  u.xx*u.yz*u.za*u.ay
          +u.xa*u.yy*u.zx*u.az  -  u.xy*u.ya*u.zx*u.az  -  u.xa*u.yx*u.zy*u.az  +  u.xx*u.ya*u.zy*u.az
          +u.xy*u.yx*u.za*u.az  -  u.xx*u.yy*u.za*u.az  -  u.xz*u.yy*u.zx*u.aa  +  u.xy*u.yz*u.zx*u.aa
          +u.xz*u.yx*u.zy*u.aa  -  u.xx*u.yz*u.zy*u.aa  -  u.xy*u.yx*u.zz*u.aa  +  u.xx*u.yy*u.zz*u.aa);
}

// ----------------------------------------------------------------------


Mat22 transpose(Mat22 const &u)
{
  return Mat22(u.xx, u.yx,
               u.xy, u.yy);
}

Mat33 transpose(Mat33 const &u)
{
  return Mat33(u.xx, u.yx, u.zx,
               u.xy, u.yy, u.zy,
               u.xz, u.yz, u.zz);
}

Mat44 transpose(Mat44 const &u)
{
  return Mat44(u.xx, u.yx, u.zx, u.ax,
               u.xy, u.yy, u.zy, u.ay,
               u.xz, u.yz, u.zz, u.az,
               u.xa, u.ya, u.za, u.aa);
}

Mat44 homoTranspose(Mat44 const &u)
{
  assert(u.ax==0.0 && u.ay==0.0 && u.az==0.0 && u.aa==1.0);
  return Mat44(u.xx, u.yx, u.zx, -u.xa,
               u.xy, u.yy, u.zy, -u.ya,
               u.xz, u.yz, u.zz, -u.za,
               0.0, 0.0, 0.0, 1.0);
}

// ----------------------------------------------------------------------

Mat22 inverse(Mat22 const &u)
{
  double invdet = 1.0 / determinant(u);

  return Mat22(+u.yy * invdet, -u.xy * invdet,
               -u.yx * invdet, +u.xx * invdet);
}

Mat33 inverse(Mat33 const &u)
{
  double invdet = 1.0 / determinant(u);
  
  return Mat33((- u.yz*u.zy + u.yy*u.zz) * invdet,  (+ u.xz*u.zy - u.xy*u.zz) * invdet,  (- u.xz*u.yy + u.xy*u.yz) * invdet,
               (+ u.yz*u.zx - u.yx*u.zz) * invdet,  (- u.xz*u.zx + u.xx*u.zz) * invdet,  (+ u.xz*u.yx - u.xx*u.yz) * invdet,
               (- u.yy*u.zx + u.yx*u.zy) * invdet,  (+ u.xy*u.zx - u.xx*u.zy) * invdet,  (- u.xy*u.yx + u.xx*u.yy) * invdet);
}

Mat44 inverse(Mat44 const &u)
{
  double invdet=1.0 / determinant(u);

  return Mat44((u.yz*u.za*u.ay - u.ya*u.zz*u.ay + u.ya*u.zy*u.az - u.yy*u.za*u.az - u.yz*u.zy*u.aa + u.yy*u.zz*u.aa)*invdet,
               (u.xa*u.zz*u.ay - u.xz*u.za*u.ay - u.xa*u.zy*u.az + u.xy*u.za*u.az + u.xz*u.zy*u.aa - u.xy*u.zz*u.aa)*invdet,
               (u.xz*u.ya*u.ay - u.xa*u.yz*u.ay + u.xa*u.yy*u.az - u.xy*u.ya*u.az - u.xz*u.yy*u.aa + u.xy*u.yz*u.aa)*invdet,
               (u.xa*u.yz*u.zy - u.xz*u.ya*u.zy - u.xa*u.yy*u.zz + u.xy*u.ya*u.zz + u.xz*u.yy*u.za - u.xy*u.yz*u.za)*invdet,
               (u.ya*u.zz*u.ax - u.yz*u.za*u.ax - u.ya*u.zx*u.az + u.yx*u.za*u.az + u.yz*u.zx*u.aa - u.yx*u.zz*u.aa)*invdet,
               (u.xz*u.za*u.ax - u.xa*u.zz*u.ax + u.xa*u.zx*u.az - u.xx*u.za*u.az - u.xz*u.zx*u.aa + u.xx*u.zz*u.aa)*invdet,
               (u.xa*u.yz*u.ax - u.xz*u.ya*u.ax - u.xa*u.yx*u.az + u.xx*u.ya*u.az + u.xz*u.yx*u.aa - u.xx*u.yz*u.aa)*invdet,
               (u.xz*u.ya*u.zx - u.xa*u.yz*u.zx + u.xa*u.yx*u.zz - u.xx*u.ya*u.zz - u.xz*u.yx*u.za + u.xx*u.yz*u.za)*invdet,
               (u.yy*u.za*u.ax - u.ya*u.zy*u.ax + u.ya*u.zx*u.ay - u.yx*u.za*u.ay - u.yy*u.zx*u.aa + u.yx*u.zy*u.aa)*invdet,
               (u.xa*u.zy*u.ax - u.xy*u.za*u.ax - u.xa*u.zx*u.ay + u.xx*u.za*u.ay + u.xy*u.zx*u.aa - u.xx*u.zy*u.aa)*invdet,
               (u.xy*u.ya*u.ax - u.xa*u.yy*u.ax + u.xa*u.yx*u.ay - u.xx*u.ya*u.ay - u.xy*u.yx*u.aa + u.xx*u.yy*u.aa)*invdet,
               (u.xa*u.yy*u.zx - u.xy*u.ya*u.zx - u.xa*u.yx*u.zy + u.xx*u.ya*u.zy + u.xy*u.yx*u.za - u.xx*u.yy*u.za)*invdet,
               (u.yz*u.zy*u.ax - u.yy*u.zz*u.ax - u.yz*u.zx*u.ay + u.yx*u.zz*u.ay + u.yy*u.zx*u.az - u.yx*u.zy*u.az)*invdet,
               (u.xy*u.zz*u.ax - u.xz*u.zy*u.ax + u.xz*u.zx*u.ay - u.xx*u.zz*u.ay - u.xy*u.zx*u.az + u.xx*u.zy*u.az)*invdet,
               (u.xz*u.yy*u.ax - u.xy*u.yz*u.ax - u.xz*u.yx*u.ay + u.xx*u.yz*u.ay + u.xy*u.yx*u.az - u.xx*u.yy*u.az)*invdet,
               (u.xy*u.yz*u.zx - u.xz*u.yy*u.zx + u.xz*u.yx*u.zy - u.xx*u.yz*u.zy - u.xy*u.yx*u.zz + u.xx*u.yy*u.zz)*invdet);
}


// ----------------------------------------------------------------------

Mat22 Mat22Rotation(double theta) { return Mat22RotationXYPlane(theta); }
Mat22 Mat22RotationXYPlane(double theta)
{
  return Mat22(cos(theta), -sin(theta),
               sin(theta), cos(theta));
}

Mat33 Mat33Rotation(Vec3 const &axis, double theta)
{
  double s = sin(theta / 2.0);
  double c = cos(theta / 2.0);
  double n = norm(axis);
  
  return toMat(Quaternion(c, axis.x * s / n, axis.y * s / n, axis.z * s / n));
}

Mat22 Mat22RotationVector(Vec2 const &src)
{
  Mat22 ret;
  ret.xx = +src.x;
  ret.xy = -src.y;
  ret.yx = +src.y;
  ret.yy = +src.x;
  return ret;
}

Mat33 Mat33RotationVectorToVector(Vec3 const &src, Vec3 const &dst)
{
  Vec3 cp = cross(src, dst);
  if (norm(cp) < 1e-8) {
    return Mat33();
  }
  double dp = dot(src, dst);
  double angle = atan2(norm(cp), dp);
  
  return Mat33Rotation(normalize(cp), angle);
}

Mat33 Mat33RotationXAxis(double theta) { return Mat33RotationYZPlane(theta); }
Mat33 Mat33RotationYZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  return Mat33(1.0, 0.0, 0.0,
               0.0, +ca, -sa,
               0.0, +sa, +ca);
}

Mat33 Mat33RotationYAxis(double theta) { return Mat33RotationXZPlane(theta); }
Mat33 Mat33RotationXZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  return Mat33(+ca, 0.0, +sa,
               0.0, 1.0, 0.0,
               -sa, 0.0, +ca);
}

Mat33 Mat33RotationZAxis(double theta) { return Mat33RotationXYPlane(theta); }
Mat33 Mat33RotationXYPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  return Mat33(+ca, -sa, 0.0,
               +sa, +ca, 0.0,
               0.0, 0.0, 1.0);
}


Mat44 Mat44RotationXAxis(double theta) { return Mat44RotationYZPlane(theta); }
Mat44 Mat44RotationYZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  return Mat44(1.0, 0.0, 0.0, 0.0,
               0.0, +ca, -sa, 0.0,
               0.0, +sa, +ca, 0.0,
               0.0, 0.0, 0.0, 1.0);
}


Mat44 Mat44RotationYAxis(double theta) { return Mat44RotationXZPlane(theta); }
Mat44 Mat44RotationXZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  return Mat44(+ca, 0.0, +sa, 0.0,
               0.0, 1.0, 0.0, 0.0,
               -sa, 0.0, +ca, 0.0,
               0.0, 0.0, 0.0, 1.0);
}

Mat44 Mat44RotationZAxis(double theta) { return Mat44RotationXYPlane(theta); }
Mat44 Mat44RotationXYPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  return Mat44(+ca, -sa, 0.0, 0.0,
               +sa, +ca, 0.0, 0.0,
               0.0, 0.0, 1.0, 0.0,
               0.0, 0.0, 0.0, 1.0);
}

Mat44 Mat44RotationXAPlane(double theta)
{ 
  die("not implemented");
  return Mat44Identity();
}
Mat44 Mat44RotationYAPlane(double theta)
{ 
  die("not implemented"); 
  return Mat44Identity();
}
Mat44 Mat44RotationZAPlane(double theta)
{ 
  die("not implemented"); 
  return Mat44Identity();
}

Mat44 Mat44Translation(double x, double y, double z)
{
  return Mat44(1.0, 0.0, 0.0, x,
               0.0, 1.0, 0.0, y,
               0.0, 0.0, 1.0, z,
               0.0, 0.0, 0.0, 1.0);
}

// ----------------------------------------------------------------------

Mat44 Mat44PerspectiveFov(double fovy, double aspect, double znear, double zfar)
{
  double height = 1.0 / tan(fovy / 2.0);
  double width = height / aspect;
  
  return Mat44(width,     0,       0,                  0,
               0,         height,  0,                  0,
               0,         0,       -zfar/(zfar-znear), -znear*zfar/(zfar-znear),
               0,         0,       -1,                 0);
}

Mat44 Mat44GeneralProjection(double xmon, double ymon, Vec3 const &dvec, double znear, double zfar)
{
  Vec3 dvecnorm = normalize(dvec);
  double zp = dvec.z;
  double q = norm(dvec);

  double dx = -dvecnorm.x;
  double dy = -dvecnorm.y;
  double dz = -dvecnorm.z;

  return Mat44(-q*dz*xmon,  0,           +q*xmon*dx,            +q*xmon*zp*dx,
               0,           -q*dz*ymon,  +q*ymon*dy,            +q*ymon*zp*dy,
               0,            0,          -zfar/(zfar-znear),    -znear*zfar/(zfar-znear),
               0,            0,          -1,                    -zp-q*dz);
}

Mat44 Mat44LookAt(Vec3 const &eyepos, Vec3 const &lookat, Vec3 const &up)
{
  Vec3 zaxis = normalize(eyepos-lookat);
  Vec3 xaxis = normalize(cross(up, zaxis));
  Vec3 yaxis = cross(zaxis, xaxis);
  
  return Mat44(xaxis.x,   xaxis.y,   xaxis.z,    -dot(xaxis, eyepos),
               yaxis.x,   yaxis.y,   yaxis.z,    -dot(yaxis, eyepos),
               zaxis.x,   zaxis.y,   zaxis.z,    -dot(zaxis, eyepos),
               0.0,       0.0,       0.0,        1.0);
}

// ----------------------------------------------------------------------

Mat33 orthonormalize(Mat33 const &u)
{
  // We use column vectors, ie the ones that the standard unit vectors are mapped onto by left-multiplication
  Vec3 vx(u.xx, u.yx, u.zx);
  Vec3 vy(u.xy, u.yy, u.zy);
  Vec3 vz(u.xz, u.yz, u.zz);

  Vec3 vxfix = normalize(cross(vy, vz));
  Vec3 vyfix = normalize(cross(vz, vxfix));
  Vec3 vzfix = normalize(cross(vxfix, vyfix));

  /*
    In the case of a rotation matrix the dot{x,y,z} terms are all ==1, but they
    could be -1 if the matrix contains a flip.
  */
  if (!(dot(vx,vxfix)>0.0)) die("!(dot(vx, vxfix)>0)");
  if (!(dot(vy,vyfix)>0.0)) die("!(dot(vy, vyfix)>0)");
  if (!(dot(vz,vzfix)>0.0)) die("!(dot(vz, vzfix)>0)");

  return Mat33(vxfix.x, vyfix.x, vzfix.x,
               vxfix.y, vyfix.y, vzfix.y,
               vxfix.z, vyfix.z, vzfix.z);
}

/*
  Somewhat specific to gyrotracker
 */

Mat33 alignWithZ(Mat33 const &u, Vec3 const &z_targ, double weight)
{
  Vec3 vx(u.xx, u.yx, u.zx);
  Vec3 vy(u.xy, u.yy, u.zy);
  Vec3 vzraw(u.xz * (1.0-weight) + z_targ.x*weight,
             u.yz * (1.0-weight) + z_targ.y*weight,
             u.zz * (1.0-weight) + z_targ.z*weight);
  Vec3 vz=normalize(vzraw);

  Vec3 vxfix = normalize(cross(vy, vz));
  Vec3 vyfix = normalize(cross(vz, vxfix));
  Vec3 vzfix = normalize(cross(vxfix, vyfix));

  if (!(dot(vx, vxfix)>0.0)) die("!(dot(vx, vxfix)>0)");
  if (!(dot(vy, vyfix)>0.0)) die("!(dot(vy, vyfix)>0)");
  if (!(dot(vz, vzfix)>0.0)) die("!(dot(vz, vzfix)>0)");

  return Mat33(vxfix.x, vyfix.x, vzfix.x,
               vxfix.y, vyfix.y, vzfix.y,
               vxfix.z, vyfix.z, vzfix.z);
}

Mat33 alignWithY(Mat33 const &u, Vec3 const &y_targ, double weight)
{
  Mat33 ret;

  Vec3 vx(u.xx, u.yx, u.zx);
  Vec3 vyraw(u.xy * (1.0-weight) + y_targ.x*weight,
             u.yy * (1.0-weight) + y_targ.y*weight,
             u.zy * (1.0-weight) + y_targ.z*weight);
  Vec3 vy = normalize(vyraw);
  Vec3 vz(u.xz, u.yz, u.zz);

  Vec3 vxfix = normalize(cross(vy, vz));
  Vec3 vzfix = normalize(cross(vxfix, vy));
  Vec3 vyfix = normalize(cross(vzfix, vxfix));

  assert(dot(vx, vxfix) > 0.0);
  assert(dot(vy, vyfix) > 0.0);
  assert(dot(vz, vzfix) > 0.0);

  return Mat33(vxfix.x, vyfix.x, vzfix.x,
               vxfix.y, vyfix.y, vzfix.y,
               vxfix.z, vyfix.z, vzfix.z);
}

Mat33 alignWithX(Mat33 const &u, Vec3 const &y_targ, double weight)
{ 
  die("not implemented"); 
  return Mat33Identity();
}

Ea3 toEa(Mat33 const &u)
{
  Ea3 ret;

  /*
    This gets then in yaw-pitch-roll order with moving coordinates.
    This should be the inverse of ea_to_mat
    
    Based on HMatrix_to_Eul with:
    order=ZXYr (yaw pitch roll) 1101 f=1 s=0 n=1 i=1 j=0 k=2 h=1

    This fails when pitch exceeds +- 90 degrees. It might be better to
    have full range of pitch and yaw with limited roll.
  */

  double cy = sqrt(u.yy*u.yy + u.xy*u.xy);
  if (cy > 16*DBL_EPSILON) {
    ret.roll = -atan2(u.zx, u.zz);
    ret.pitch = -atan2(-u.zy, cy);
    ret.yaw = -atan2(u.xy, u.yy);
  } else {
    ret.roll = -atan2(-u.xz, u.xx);
    ret.pitch = -atan2(-u.zy, cy);
    ret.yaw = 0;
  }

  return ret;
}

Mat33 toMat(Ea3 const &u)
{
  return operator *(Mat33RotationZAxis(u.yaw), operator *(Mat33RotationXAxis(u.pitch), Mat33RotationYAxis(u.roll)));
}

/*
  http://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
*/
Mat33 toMat(Quaternion const &u)
{
  Mat33 ret;

  ret.xx = 1 - 2.0 * (u.c*u.c + u.d*u.d);
  ret.xy =     2.0 * (u.b*u.c - u.a*u.d);
  ret.xz =     2.0 * (u.a*u.c + u.b*u.d);
                                      
  ret.yx =     2.0 * (u.b*u.c + u.a*u.d);
  ret.yy = 1 - 2.0 * (u.b*u.b + u.d*u.d);
  ret.yz =     2.0 * (u.c*u.d - u.a*u.b);
                                      
  ret.zx =     2.0 * (u.b*u.d - u.a*u.c);
  ret.zy =     2.0 * (u.a*u.b + u.c*u.d);
  ret.zz = 1 - 2.0 * (u.b*u.b + u.c*u.c);

  return ret;
}

Quaternion toQuat(Ea3 const &u)
{
  double ti = +0.5 * u.roll;
  double tj = -0.5 * u.pitch;
  double th = +0.5 * u.yaw;
  double ci = cos(ti);  double cj = cos(tj);  double ch = cos(th);
  double si = sin(ti);  double sj = sin(tj);  double sh = sin(th);

  Quaternion ret(+ cj*ci*ch + sj*si*sh,
                 - cj*si*sh - sj*ci*ch,
                 + cj*si*ch - sj*ci*sh,
                 + cj*ci*sh - sj*si*ch);

  if (ret.a < 0.0) {
    return Quaternion(-ret.a, -ret.b, -ret.c, -ret.d);
  } else {
    return ret;
  }
}


// ----------------------------------------------------------------------

Vec2 cross(Vec2 const &u, Vec2 const &v)
{
  die("not implemented"); 
  return Vec2(0.0, 0.0);
}

Vec3 cross(Vec3 const &u, Vec3 const &v)
{
  return Vec3(u.y*v.z - u.z*v.y,
              u.z*v.x - u.x*v.z,
              u.x*v.y - u.y*v.x);
}

Vec4 cross(Vec4 const &u, Vec4 const &v)
{
  die("not implemented");
  return Vec4(0.0, 0.0, 0.0, 0.0);
}


// ----------------------------------------------------------------------

Mat22 Mat22Identity()
{
  return Mat22(1.0, 0.0, 
               0.0, 1.0);
}

Mat33 Mat33Identity()
{
  return Mat33(1.0, 0.0, 0.0, 
               0.0, 1.0, 0.0, 
               0.0, 0.0, 1.0);
}

Mat44 Mat44Identity()
{
  return Mat44(1.0, 0.0, 0.0, 0.0, 
               0.0, 1.0, 0.0, 0.0, 
               0.0, 0.0, 1.0, 0.0, 
               0.0, 0.0, 0.0, 1.0);
}

// ----------------------------------------------------------------------

Vec2 normalize(Vec2 const &u)
{
  double n = norm(u);
  if (n == 0.0) return u;
  return operator *(u, 1.0/n);
}

Vec3 normalize(Vec3 const &u)
{
  double n = norm(u);
  if (n == 0.0) return u;
  return operator *(u, 1.0/n);
}

Vec4 normalize(Vec4 const &u)
{
  double n = norm(u);
  if (n==0.0) return u;
  return operator *(u, 1.0/n);
}

Mat22 normalize(Mat22 const &u)
{
  die("not implemented"); 
  return u;
}

Mat33 normalize(Mat33 const &u)
{
  die("not implemented"); 
  return u;
}

Mat44 normalize(Mat44 const &u)
{
  die("not implemented"); 
  return u;
}

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------

double normsq(Vec2 const &u)
{
  return sqr(u.x) + sqr(u.y);
}

double normsq(Vec3 const &u)
{
  return sqr(u.x) + sqr(u.y) + sqr(u.z);
}

double normsq(Vec4 const &u)
{
  return sqr(u.x) + sqr(u.y) + sqr(u.z) + sqr(u.a);
}

double normsq(Mat22 const &u)
{
  return (sqr(u.xx) + sqr(u.xy) + 
          sqr(u.yx) + sqr(u.yy));
}

double normsq(Mat33 const &u)
{
  return (sqr(u.xx) + sqr(u.xy) + sqr(u.xz) +
          sqr(u.yx) + sqr(u.yy) + sqr(u.yz) +
          sqr(u.zx) + sqr(u.zy) + sqr(u.zz));
}

double normsq(Mat44 const &u)
{
  return (sqr(u.xx) + sqr(u.xy) + sqr(u.xz) + sqr(u.xa) +
          sqr(u.yx) + sqr(u.yy) + sqr(u.yz) + sqr(u.ya) +
          sqr(u.zx) + sqr(u.zy) + sqr(u.zz) + sqr(u.za) +
          sqr(u.ax) + sqr(u.ay) + sqr(u.az) + sqr(u.aa));
}

double normsq(Ea3 const &u)
{
  return sqr(u.pitch) + sqr(u.roll) + sqr(u.yaw);
}

double normsq(Quaternion const &u)
{
  return sqr(u.a) + sqr(u.b) + sqr(u.c) + sqr(u.d);
}

double norm(Vec2 const &u)
{
  return sqrt(normsq(u));
}
double norm(Vec3 const &u)
{
  return sqrt(normsq(u));
}
double norm(Vec4 const &u)
{
  return sqrt(normsq(u));
}
double norm(Mat22 const &u)
{
  return sqrt(normsq(u));
}
double norm(Mat33 const &u)
{
  return sqrt(normsq(u));
}
double norm(Mat44 const &u)
{
  return sqrt(normsq(u));
}
double norm(Ea3 const &u)
{
  return sqrt(normsq(u));
}
double norm(Quaternion const &u)
{
  return sqrt(normsq(u));
}

// ----------------------------------------------------------------------

void setRow(Mat22 &u, int ri, Vec2 const &v)
{
  switch(ri) {
  case 0: 
    u.xx=v.x; u.xy=v.y;
    break;
  case 1: 
    u.yx=v.x; u.yy=v.y;
    break;
  default:
    abort();
  }
}

void setCol(Mat22 &u, int ci, Vec2 const &v)
{
  switch(ci) {
  case 0: 
    u.xx=v.x; u.yx=v.y;
    break;
  case 1: 
    u.xy=v.x; u.yy=v.y;
    break;
  default:
    abort();
  }
}

Vec2 getRow(Mat22 const &u, int ri)
{
  switch(ri) {
  case 0: 
    return Vec2(u.xx, u.xy);
  case 1: 
    return Vec2(u.yx, u.yy);
  default:
    abort();
  }
}

Vec2 getCol(Mat22 const &u, int ci)
{
  switch(ci) {
  case 0: 
    return Vec2(u.xx, u.yx);
  case 1: 
    return Vec2(u.xy, u.yy);
  default:
    abort();
  }
}


void setRow(Mat33 &u, int ri, Vec3 const &v)
{
  switch(ri) {
  case 0: 
    u.xx=v.x; u.xy=v.y; u.xz=v.z;
    break;
  case 1: 
    u.yx=v.x; u.yy=v.y; u.yz=v.z;
    break;
  case 2: 
    u.zx=v.x; u.zy=v.y; u.zz=v.z;
    break;
  default:
    abort();
  }
}

void setCol(Mat33 &u, int ci, Vec3 const &v)
{
  switch(ci) {
  case 0: 
    u.xx=v.x; u.yx=v.y; u.zx=v.z;
    break;
  case 1: 
    u.xy=v.x; u.yy=v.y; u.zy=v.z;
    break;
  case 2: 
    u.xz=v.x; u.yz=v.y; u.zz=v.z;
    break;
  default:
    abort();
  }
}

Vec3 getRow(Mat33 const &u, int ri) 
{
  switch(ri) {
  case 0: 
    return Vec3(u.xx, u.xy, u.xz);
  case 1: 
    return Vec3(u.yx, u.yy, u.yz);
  case 2: 
    return Vec3(u.zx, u.zy, u.zz);
  default:
    abort();
  }
}

Vec3 getCol(Mat33 const &u, int ci)
{
  switch(ci) {
  case 0: 
    return Vec3(u.xx, u.yx, u.zx);
  case 1: 
    return Vec3(u.xy, u.yy, u.zy);
  case 2: 
    return Vec3(u.xz, u.yz, u.zz);
  default:
    abort();
  }
}


void setRow(Mat44 &u, int ri, Vec4 const &v)
{
  switch(ri) {
  case 0: 
    u.xx=v.x; u.xy=v.y; u.xz=v.z; u.xa=v.a;
    break;
  case 1: 
    u.yx=v.x; u.yy=v.y; u.yz=v.z; u.ya=v.a;
    break;
  case 2: 
    u.zx=v.x; u.zy=v.y; u.zz=v.z; u.za=v.a;
    break;
  case 3: 
    u.ax=v.x; u.ay=v.y; u.az=v.z; u.aa=v.a;
    break;
  default:
    abort();
  }
}

void setCol(Mat44 &u, int ci, Vec4 const &v)
{
  switch(ci) {
  case 0:
    u.xx=v.x; u.yx=v.y; u.zx=v.z; u.ax=v.a;
    break;
  case 1: 
    u.xy=v.x; u.yy=v.y; u.zy=v.z; u.ay=v.a;
    break;
  case 2: 
    u.xz=v.x; u.yz=v.y; u.zz=v.z; u.az=v.a;
    break;
  case 3: 
    u.xa=v.x; u.ya=v.y; u.za=v.z; u.aa=v.a;
    break;
  default:
    abort();
  }
}

Vec4 getRow(Mat44 const &u, int ri)
{
  switch(ri) {
  case 0: 
    return Vec4(u.xx, u.xy, u.xz, u.xa);
  case 1: 
    return Vec4(u.yx, u.yy, u.yz, u.ya);
  case 2: 
    return Vec4(u.zx, u.zy, u.zz, u.za);
  case 3: 
    return Vec4(u.ax, u.ay, u.az, u.aa);
  default:
    abort();
  }
}

Vec4 getCol(Mat44 const &u, int ci)
{
  switch(ci) {
  case 0: 
    return Vec4(u.xx, u.yx, u.zx, u.ax);
  case 1: 
    return Vec4(u.xy, u.yy, u.zy, u.ay);
  case 2: 
    return Vec4(u.xz, u.yz, u.zz, u.az);
  case 3: 
    return Vec4(u.xa, u.ya, u.za, u.aa);
  default:
    abort();
  }
}

// ----------------------------------------------------------------------

Mat33 justRotation(Mat44 const &u)
{
  //assert(ax==0.0 && ay==0.0 && az==0.0 && aa==1.0);
  return Mat33(u.xx, u.xy, u.xz,
               u.yx, u.yy, u.yz,
               u.zx, u.zy, u.zz);
}

Vec3 justTranslation(Mat44 const &u)
{
  //assert(ax==0.0 && ay==0.0 && az==0.0 && aa==1.0);
  return Vec3(u.xa, u.ya, u.za);
}

// ----------------------------------------------------------------------

// for testing numerical stability of rotation
Mat33 twaddle(Mat33 const &u, double rotsigma, int niter)
{
  Mat33 tmp = u;
  for (int iter = 0; iter < niter; iter++) {
    double rx = frandom_normal() * rotsigma;
    double ry = frandom_normal() * rotsigma;
    double rz = frandom_normal() * rotsigma;

    tmp = operator *(Mat33RotationZAxis(rz), operator *(Mat33RotationYAxis(ry), operator *(Mat33RotationXAxis(rx), tmp)));
  }
  return tmp;
}

/* ----------------------------------------------------------------------
   Polyfit 
*/

double getValue(Polyfit3 const &u, double t)
{
  return u.c0 + t*(u.c1 + (t*(u.c2 + t*u.c3)));
}
double getDerivative(Polyfit3 const &u, double t)
{
  return u.c1 + 2.0*u.c2*t + 3.0*u.c3*t*t;
}


#include "../common/std_headers.h"
#include "./geom_math.h"

using namespace arma;

#define nan (numeric_limits<double>::quiet_NaN())

double limit(double v, double lo, double hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

mat33 orthonormalise(mat33 const &u)
{
  // We use column vectors, ie the ones that the standard unit vectors are mapped onto by left-multiplication
  vec3 vx = u.col(0);
  vec3 vy = u.col(1);
  vec3 vz = u.col(2);

  vec3 vxfix = normalise(cross(vy, vz));
  vec3 vyfix = normalise(cross(vz, vxfix));
  vec3 vzfix = normalise(cross(vxfix, vyfix));

  /*
    In the case of a rotation matrix the dot{x,y,z} terms are all ==1, but they
    could be -1 if the matrix contains a flip.
  */
  if (!(dot(vx, vxfix)>0.0)) throw runtime_error("!(dot(vx, vxfix)>0)");
  if (!(dot(vy, vyfix)>0.0)) throw runtime_error("!(dot(vy, vyfix)>0)");
  if (!(dot(vz, vzfix)>0.0)) throw runtime_error("!(dot(vz, vzfix)>0)");

  mat33 ret;
  ret.col(0) = vxfix;
  ret.col(1) = vyfix;
  ret.col(2) = vzfix;
  return ret;
}

// ----------------------------------------------------------------------

vec vecFromHomo(vec const &u)
{
  if (u.n_elem == 4) {
    vec ret(3);
    ret[0] = u[0] / u[3];
    ret[1] = u[1] / u[3];
    ret[2] = u[2] / u[3];
    return ret;
  }
  else {
    throw runtime_error(stringprintf("fromHomo(vec(%d)) not implemented", (int)u.n_elem));
  }
}

vec vecToHomo(vec const &u)
{
  if (u.n_elem == 3) {
    vec ret(4);
    ret[0] = u[0];
    ret[1] = u[1];
    ret[2] = u[2];
    ret[3] = 1.0;
    return ret;
  }
  else {
    throw runtime_error(stringprintf("toHomo(vec(%d)) not implemented", (int)u.n_elem));
  }
}

mat matToHomo(mat const &u)
{
  if (u.n_rows == 2 && u.n_cols == 2) {
    mat ret(3,3);
    ret(0,0) = u(0,0);
    ret(0,1) = u(0,1);
    ret(0,2) = 0.0;
    ret(1,0) = u(1,0);
    ret(1,1) = u(1,1);
    ret(1,2) = 0.0;
    ret(2,0) = 0.0;
    ret(2,1) = 0.0;
    ret(2,2) = 1.0;
    return ret;
  }
  else if (u.n_rows == 3 && u.n_cols == 3) {
    mat ret(4,4);
    ret(0,0) = u(0,0);
    ret(0,1) = u(0,1);
    ret(0,2) = u(0,2);
    ret(0,3) = 0.0;
    ret(1,0) = u(1,0);
    ret(1,1) = u(1,1);
    ret(1,2) = u(1,2);
    ret(1,3) = 0.0;
    ret(2,0) = u(2,0);
    ret(2,1) = u(2,1);
    ret(2,2) = u(2,2);
    ret(2,3) = 0.0;
    ret(3,0) = 0.0;
    ret(3,1) = 0.0;
    ret(3,2) = 0.0;
    ret(3,3) = 1.0;
    return ret;
  }
  else {
    throw runtime_error(stringprintf("toHomo(mat(%d, %d)) not implemented", (int)u.n_rows, (int)u.n_cols));
  }
}

mat matFromHomo(mat const &u)
{
  throw runtime_error(stringprintf("fromHomo(mat(%d, %d)) not implemented", (int)u.n_rows, (int)u.n_cols));
}

// ----------------------------------------------------------------------

mat22 mat22Rotation(double theta) { return mat22RotationXYPlane(theta); }
mat22 mat22RotationXYPlane(double theta)
{
  mat22 ret;
  ret(0,0) = cos(theta);
  ret(0,1) = -sin(theta);
  ret(1,0) = sin(theta);
  ret(1,1) = cos(theta);
  return ret;
}


mat33 mat33Rotation(vec3 const &axis, double theta)
{
  double s = sin(theta / 2.0);
  double c = cos(theta / 2.0);
  double n = norm(axis, 2);
  Quaternion q;
  q[0] = c;
  q[1] = axis(0) * s / n;
  q[2] = axis(1) * s / n;
  q[3] = axis(2) * s / n;
  
  return quatToMat(q);
}

mat22 mat22RotationVector(vec2 const &src)
{
  mat22 ret;
  ret(0,0) = +src(0);
  ret(0,1) = -src(1);
  ret(1,0) = +src(1);
  ret(1,1) = +src(0);
  return ret;
}

mat33 mat33RotationVectorToVector(vec3 const &src, vec3 const &dst)
{
  vec3 cp = cross(src, dst);
  if (norm(cp, 2) < 1e-8) {
    return mat33(fill::eye);
  }
  double dp = dot(src, dst);
  double angle = atan2(norm(cp, 2), dp);
  
  return mat33Rotation(normalise(cp), angle);
}

mat33 mat33RotationXAxis(double theta) { return mat33RotationYZPlane(theta); }
mat33 mat33RotationYZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  mat33 ret(fill::eye);
  ret(0,0) = 1.0;
  ret(0,1) = 0.0;
  ret(0,2) = 0.0;
  ret(1,0) = 0.0;
  ret(1,1) = +ca;
  ret(1,2) = -sa;
  ret(2,0) = 0.0;
  ret(2,1) = +sa;
  ret(2,2) = +ca;
  return ret;
}

mat33 mat33RotationYAxis(double theta) { return mat33RotationXZPlane(theta); }
mat33 mat33RotationXZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  mat33 ret(fill::eye);
  ret(0,0) = +ca;
  ret(0,2) = +sa;
  ret(2,0) = -sa;
  ret(2,2) = +ca;
  return ret;
}

mat33 mat33RotationZAxis(double theta) { return mat33RotationXYPlane(theta); }
mat33 mat33RotationXYPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  mat33 ret(fill::eye);
  ret(0,0) = +ca;
  ret(0,1) = -sa;
  ret(1,0) = +sa;
  ret(1,1) = +ca;
  return ret;
}


mat44 mat44RotationXAxis(double theta) { return mat44RotationYZPlane(theta); }
mat44 mat44RotationYZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  mat44 ret(fill::eye);
  ret(1,1) = +ca;
  ret(1,2) = -sa;
  ret(2,1) = +sa;
  ret(2,2) = +ca;
  return ret;
}


mat44 mat44RotationYAxis(double theta) { return mat44RotationXZPlane(theta); }
mat44 mat44RotationXZPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  mat44 ret(fill::eye);
  ret(0,0) = +ca;
  ret(0,2) = +sa;
  ret(2,0) = -sa;
  ret(2,2) = +ca;
  return ret;
}

mat44 mat44RotationZAxis(double theta) { return mat44RotationXYPlane(theta); }
mat44 mat44RotationXYPlane(double theta)
{
  double ca = cos(theta);
  double sa = sin(theta);

  mat44 ret(fill::eye);
  ret(0,0) = +ca;
  ret(0,1) = -sa;
  ret(1,0) = +sa;
  ret(1,1) = +ca;
  return ret;
}

mat44 mat44RotationXAPlane(double theta)
{ 
  throw runtime_error("not implemented");
}
mat44 mat44RotationYAPlane(double theta)
{ 
  throw runtime_error("not implemented");
}
mat44 mat44RotationZAPlane(double theta)
{ 
  throw runtime_error("not implemented");
}

mat44 mat44Translation(double x, double y, double z)
{
  mat44 ret(fill::eye);
  ret(0,3) = x;
  ret(1,3) = y;
  ret(2,3) = z;
  return ret;
}

// ----------------------------------------------------------------------

mat44 mat44PerspectiveFov(double fovy, double aspect, double znear, double zfar)
{
  double height = 1.0 / tan(fovy / 2.0);
  double width = height / aspect;

  mat44 ret(fill::zeros);
  ret(0,0) = width;
  ret(1,1) = height;
  ret(2,2) = -zfar/(zfar-znear);
  ret(2,3) = -znear*zfar/(zfar-znear);
  ret(3,2) = -1;
  return ret;
}

mat44 mat44GeneralProjection(double xmon, double ymon, vec3 const &dvec, double znear, double zfar)
{
  vec3 dvecnorm = normalise(dvec);
  double zp = dvec(2);
  double q = norm(dvec, 2);

  double dx = -dvecnorm(0);
  double dy = -dvecnorm(1);
  double dz = -dvecnorm(2);

  mat44 ret(fill::zeros);
  ret(0,0) = -q*dz*xmon;
  ret(0,2) = +q*xmon*dx;
  ret(0,3) = +q*xmon*dx*zp;
  ret(1,1) = -q*dz*ymon;
  ret(1,2) = +q*ymon*dy;
  ret(1,3) = +q*ymon*dy*zp;
  ret(2,2) = -zfar/(zfar-znear);
  ret(2,3) = -znear*zfar/(zfar-znear);
  ret(3,2) = -1;
  ret(3,3) = -zp-q*dz;
  return ret;
}

mat44 mat44LookAt(vec3 const &eyepos, vec3 const &lookat, vec3 const &up)
{
  vec3 zaxis = normalise(eyepos-lookat);
  vec3 xaxis = normalise(cross(up, zaxis));
  vec3 yaxis = cross(zaxis, xaxis);
  
  mat44 ret(fill::zeros);
  ret(0,0) = xaxis(0);
  ret(0,1) = xaxis(1);
  ret(0,2) = xaxis(2);
  ret(0,3) = -dot(xaxis, eyepos);
  ret(1,0) = yaxis(0);
  ret(1,1) = yaxis(1);
  ret(1,2) = yaxis(2);
  ret(1,3) = dot(yaxis, eyepos);
  ret(2,0) = zaxis(0);
  ret(2,1) = zaxis(1);
  ret(2,2) = zaxis(2);
  ret(2,3) = -dot(zaxis, eyepos);
  ret(3,3) = 1.0;
  return ret;
}

// ----------------------------------------------------------------------


/*
  Somewhat specific to gyrotracker
 */

mat33 alignWithZ(mat33 const &u, vec3 const &z_targ, double weight)
{
  vec3 vx = u.col(0);
  vec3 vy = u.col(1);
  vec3 vz = normalise(u.col(2) * (1.0-weight) + z_targ*weight);

  vec3 vxfix = normalise(cross(vy, vz));
  vec3 vyfix = normalise(cross(vz, vxfix));
  vec3 vzfix = normalise(cross(vxfix, vyfix));

  if (!(dot(vx, vxfix)>0.0)) throw runtime_error("!(dot(vx, vxfix)>0)");
  if (!(dot(vy, vyfix)>0.0)) throw runtime_error("!(dot(vy, vyfix)>0)");
  if (!(dot(vz, vzfix)>0.0)) throw runtime_error("!(dot(vz, vzfix)>0)");

  mat33 ret;
  ret.col(0) = vxfix;
  ret.col(1) = vyfix;
  ret.col(2) = vzfix;
  return ret;
}

mat33 alignWithY(mat33 const &u, vec3 const &y_targ, double weight)
{
  vec3 vx = u.col(0);
  vec3 vy = normalise(u.col(1) * (1.0-weight) + y_targ * weight);
  vec3 vz = u.col(2);

  vec3 vxfix = normalise(cross(vy, vz));
  vec3 vzfix = normalise(cross(vxfix, vy));
  vec3 vyfix = normalise(cross(vzfix, vxfix));

  if (!(dot(vx, vxfix)>0.0)) throw runtime_error("!(dot(vx, vxfix)>0)");
  if (!(dot(vy, vyfix)>0.0)) throw runtime_error("!(dot(vy, vyfix)>0)");
  if (!(dot(vz, vzfix)>0.0)) throw runtime_error("!(dot(vz, vzfix)>0)");

  mat33 ret(fill::zeros);
  ret.col(0) = vxfix;
  ret.col(1) = vyfix;
  ret.col(2) = vzfix;
  return ret;
}

mat33 alignWithX(mat33 const &u, vec3 const &y_targ, double weight)
{ 
  throw runtime_error("not implemented");
}

EulerAngles matToEuler(mat33 const &u)
{
  EulerAngles ret(fill::zeros);

  /*
    This gets then in yaw-pitch-roll order with moving coordinates.
    This should be the inverse of ea_to_mat
    
    Based on HMatrix_to_Eul with:
    order=ZXYr (yaw pitch roll) 1101 f=1 s=0 n=1 i=1 j=0 k=2 h=1

    This fails when pitch exceeds +- 90 degrees. It might be better to
    have full range of pitch and yaw with limited roll.
  */

  double cy = sqrt(u(1,1)*u(1,1) + u(0,1)*u(0,1));
  if (cy > 16*DBL_EPSILON) {
    ret(1) = -atan2(+u(2,0), +u(2,2));
    ret(0) = -atan2(-u(2,1), +cy);
    ret(2) = -atan2(+u(0,1), +u(1,1));
  } else {
    ret(1) = -atan2(-u(0,2), +u(0,0));
    ret(0) = -atan2(-u(2,1), +cy);
    ret(2) = 0;
  }

  return ret;
}

mat33 eulerToMat(EulerAngles const &u)
{
  return mat33RotationZAxis(u(2)) * (mat33RotationXAxis(u(0)) * mat33RotationYAxis(u(1)));
}

/*
  http://en.wikipedia.org/wiki/Conversion_between_quaternions_and_Euler_angles
*/
mat33 quatToMat(Quaternion const &u)
{
  mat33 ret(fill::zeros);

  ret(0,0) = 1 - 2.0 * (u(2)*u(2) + u(3)*u(3));
  ret(0,1) =     2.0 * (u(1)*u(2) - u(0)*u(3));
  ret(0,2) =     2.0 * (u(0)*u(2) + u(1)*u(3));
                                      
  ret(1,0) =     2.0 * (u(1)*u(2) + u(0)*u(3));
  ret(1,1) = 1 - 2.0 * (u(1)*u(1) + u(3)*u(3));
  ret(1,2) =     2.0 * (u(2)*u(3) - u(0)*u(1));
                                      
  ret(2,0) =     2.0 * (u(1)*u(3) - u(0)*u(2));
  ret(2,1) =     2.0 * (u(0)*u(1) + u(2)*u(3));
  ret(2,2) = 1 - 2.0 * (u(1)*u(1) + u(2)*u(2));

  return ret;
}

Quaternion eulerToQuat(EulerAngles const &u)
{
  double ti = +0.5 * u(1); // roll
  double tj = -0.5 * u(0); // pitch
  double th = +0.5 * u(2); // yaw
  double ci = cos(ti);  double cj = cos(tj);  double ch = cos(th);
  double si = sin(ti);  double sj = sin(tj);  double sh = sin(th);

  Quaternion ret;
  ret(0) = + cj*ci*ch + sj*si*sh;
  ret(1) = - cj*si*sh - sj*ci*ch;
  ret(2) = + cj*si*ch - sj*ci*sh;
  ret(3) = + cj*ci*sh - sj*si*ch;
  
  if (ret[0] < 0.0) {
    return -ret;
  } else {
    return ret;
  }
}

Quaternion grassmanProduct(const Quaternion &u, const Quaternion &v)
{
  Quaternion ret;
  ret[0] = u[0]*v[0] - u[1]*v[1] - u[2]*v[2] - u[3]*v[3];
  ret[1] = u[0]*v[1] + u[1]*v[0] + u[2]*v[3] - u[3]*v[2];
  ret[2] = u[0]*v[2] - u[1]*v[3] + u[2]*v[0] + u[3]*v[1];
  ret[3] = u[0]*v[3] + u[1]*v[2] - u[2]*v[1] + u[3]*v[0];
  return ret;
}

// ----------------------------------------------------------------------

mat33 justRotation(mat44 const &u)
{
  mat33 ret(fill::zeros);
  for (int ri=0; ri<3; ri++) {
    for (int ci=0; ci<3; ci++) {
      ret(ri, ci) = u(ri, ci);
    }
  }
  return ret;
}

vec3 justTranslation(mat44 const &u)
{
  vec3 ret(fill::zeros);
  ret(0) = u(0,3);
  ret(1) = u(1,3);
  ret(2) = u(2,3);
  return ret;
}

// ----------------------------------------------------------------------

// for testing numerical stability of rotation
mat33 randomTwaddle(mat33 const &u, double rotsigma, int niter)
{
  mat33 tmp = u;
  for (int iter = 0; iter < niter; iter++) {
    double rx = frandom_normal() * rotsigma;
    double ry = frandom_normal() * rotsigma;
    double rz = frandom_normal() * rotsigma;
    
    tmp = mat33RotationZAxis(rz) * (mat33RotationYAxis(ry) * (mat33RotationXAxis(rx) * tmp));
  }
  return tmp;
}


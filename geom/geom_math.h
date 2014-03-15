#ifndef INCLUDE_ur_geom_math_h
#define INCLUDE_ur_geom_math_h

/*
  Needs to be parseable by code_gen, to generate wrapper stubs
 */

typedef arma::vec4 Quaternion;
typedef arma::vec3 EulerAngles;

double sqr(double x);
double limit(double v, double lo, double hi);

/*
  Convert to/from homogeneous form.
*/
arma::vec vecFromHomo(arma::vec const &u);
arma::vec vecToHomo(arma::vec const &u);
arma::mat matToHomo(arma::mat const &u);
arma::mat matFromHomo(arma::mat const &u);

arma::vec normalize(arma::vec const &u);
arma::mat33 orthonormalize(arma::mat33 const &u);

arma::mat22 mat22Rotation(double theta);
arma::mat22 mat22RotationXYPlane(double theta);
arma::mat33 mat33Rotation(arma::vec3 const &axis, double theta);
arma::mat22 mat22RotationVector(arma::vec2 const &src);
arma::mat33 mat33RotationVectorToVector(arma::vec3 const &src, arma::vec3 const &dst);
arma::mat33 mat33RotationXAxis(double theta);
arma::mat33 mat33RotationYZPlane(double theta);
arma::mat33 mat33RotationYAxis(double theta);
arma::mat33 mat33RotationXZPlane(double theta);
arma::mat33 mat33RotationZAxis(double theta);
arma::mat33 mat33RotationXYPlane(double theta);
arma::mat44 mat44RotationXAxis(double theta);
arma::mat44 mat44RotationYZPlane(double theta);
arma::mat44 mat44RotationYAxis(double theta);
arma::mat44 mat44RotationXZPlane(double theta);
arma::mat44 mat44RotationZAxis(double theta);
arma::mat44 mat44RotationXYPlane(double theta);
arma::mat44 mat44RotationXAPlane(double theta);
arma::mat44 mat44RotationYAPlane(double theta);
arma::mat44 mat44RotationZAPlane(double theta);

arma::mat44 mat44Translation(double x, double y, double z);
arma::mat44 mat44PerspectiveFov(double fovy, double aspect, double znear, double zfar);
arma::mat44 mat44GeneralProjection(double xmon, double ymon, arma::vec3 const &dvec, double znear, double zfar);
arma::mat44 mat44LookAt(arma::vec3 const &eyepos, arma::vec3 const &lookat, arma::vec3 const &up);


arma::mat33 alignWithZ(arma::mat33 const &u, arma::vec3 const &z_targ, double weight);
arma::mat33 alignWithY(arma::mat33 const &u, arma::vec3 const &y_targ, double weight);
arma::mat33 alignWithX(arma::mat33 const &u, arma::vec3 const &y_targ, double weight);

EulerAngles matToEuler(arma::mat33 const &u);
arma::mat33 eulerToMat(EulerAngles const &u);
arma::mat33 quatToMat(Quaternion const &u);
Quaternion eulerToQuat(EulerAngles const &u);
Quaternion grassmanProduct(const Quaternion &u, const Quaternion &v);

arma::mat33 justRotation(arma::mat44 const &u);
arma::vec3 justTranslation(arma::mat44 const &u);

arma::mat33 twaddle(arma::mat33 const &u, double rotsigma, int niter);

// Conveniences that surprisingly aren't supplied by arma

inline arma::vec2 mkVec2(double _0, double _1) {
  arma::vec2 ret;
  ret[0] = _0;
  ret[1] = _1;
  return ret;
}

inline arma::vec3 mkVec3(double _0, double _1, double _2) {
  arma::vec3 ret;
  ret[0] = _0;
  ret[1] = _1;
  ret[2] = _2;
  return ret;
}

inline arma::vec4 mkVec4(double _0, double _1, double _2, double _3) {
  arma::vec4 ret;
  ret[0] = _0;
  ret[1] = _1;
  ret[2] = _2;
  ret[3] = _3;
  return ret;
}

inline arma::mat33 mkMat33(double _00, double _01, double _02, 
                           double _10, double _11, double _12, 
                           double _20, double _21, double _22) {
  arma::mat33 ret;
  ret(0,0) = _00;
  ret(0,1) = _01;
  ret(0,2) = _02;
  ret(1,0) = _10;
  ret(1,1) = _11;
  ret(1,2) = _12;
  ret(2,0) = _20;
  ret(2,1) = _21;
  ret(2,2) = _22;
  return ret;
}

inline arma::mat44 mkMat44(double _00, double _01, double _02, double _03, 
                           double _10, double _11, double _12, double _13, 
                           double _20, double _21, double _22, double _23, 
                           double _30, double _31, double _32, double _33) {
  arma::mat44 ret;
  ret(0,0) = _00;
  ret(0,1) = _01;
  ret(0,2) = _02;
  ret(0,3) = _03;
  ret(1,0) = _10;
  ret(1,1) = _11;
  ret(1,2) = _12;
  ret(1,3) = _13;
  ret(2,0) = _20;
  ret(2,1) = _21;
  ret(2,2) = _22;
  ret(2,3) = _23;
  ret(3,0) = _30;
  ret(3,1) = _31;
  ret(3,2) = _32;
  ret(3,3) = _33;
  return ret;
}

#endif

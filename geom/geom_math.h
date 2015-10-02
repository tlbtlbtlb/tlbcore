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

arma::vec normalise(arma::vec const &u);
arma::mat33 orthonormalise(arma::mat33 const &u);

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

arma::mat33 randomTwaddle(arma::mat33 const &u, double rotsigma, int niter);

#endif

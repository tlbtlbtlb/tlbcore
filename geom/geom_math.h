#ifndef INCLUDE_ur_geom_math_h
#define INCLUDE_ur_geom_math_h

#include "build.src/Vec2_decl.h"
#include "build.src/Vec3_decl.h"
#include "build.src/Vec4_decl.h"
#include "build.src/Mat22_decl.h"
#include "build.src/Mat33_decl.h"
#include "build.src/Mat44_decl.h"
#include "build.src/Ea3_decl.h"
#include "build.src/Polyfit3_decl.h"
#include "build.src/Quaternion_decl.h"

double sqr(double x);

double limit(double v, double lo, double hi);

Vec2 operator +(Vec2 const &u, Vec2 const &v);
Vec3 operator +(Vec3 const &u, Vec3 const &v);
Vec4 operator +(Vec4 const &u, Vec4 const &v);
Vec2 operator -(Vec2 const &u, Vec2 const &v);
Vec3 operator -(Vec3 const &u, Vec3 const &v);
Vec4 operator -(Vec4 const &u, Vec4 const &v);

Mat22 operator +(Mat22 const &u, Mat22 const &v);
Mat33 operator +(Mat33 const &u, Mat33 const &v);
Mat44 operator +(Mat44 const &u, Mat44 const &v);
Mat22 operator -(Mat22 const &u, Mat22 const &v);
Mat33 operator -(Mat33 const &u, Mat33 const &v);
Mat44 operator -(Mat44 const &u, Mat44 const &v);

bool operator ==(Vec2 const &u, Vec2 const &v);
bool operator ==(Vec3 const &u, Vec3 const &v);
bool operator ==(Vec4 const &u, Vec4 const &v);
bool operator ==(Mat22 const &u, Mat22 const &v);
bool operator ==(Mat33 const &u, Mat33 const &v);
bool operator ==(Mat44 const &u, Mat44 const &v);

Vec2 operator *(Vec2 const &u, double v);
Vec3 operator *(Vec3 const &u, double v);
Vec4 operator *(Vec4 const &u, double v);

Mat22 operator *(Mat22 const &l, Mat22 const &r);
Mat33 operator *(Mat33 const &l, Mat33 const &r);
Mat44 operator *(Mat44 const &l, Mat44 const &r);

Vec2 operator *(Mat22 const &l, Vec2 const &r);
Vec3 operator *(Mat33 const &l, Vec3 const &r);
Vec4 operator *(Mat44 const &l, Vec4 const &r);
Vec3 operator *(Mat44 const &l, Vec3 const &r);

Quaternion grassmanProduct(const Quaternion &u, const Quaternion &v);

double dot(Vec2 const &u, Vec2 const &v);
double dot(Vec3 const &u, Vec3 const &v);
double dot(Vec4 const &u, Vec4 const &v);
                                     
Vec2 cross(Vec2 const &u, Vec2 const &v);
Vec3 cross(Vec3 const &u, Vec3 const &v);
Vec4 cross(Vec4 const &u, Vec4 const &v);

Vec3 fromHomo(Vec4 const &u);
Vec4 toHomo(Vec3 const &u);
Mat44 toHomo(Mat33 const &u);
Mat33 fromHomo(Mat44 const &u);

double determinant(Mat22 const &u);
double determinant(Mat33 const &u);
double determinant(Mat44 const &u);

Mat22 transpose(Mat22 const &u);
Mat33 transpose(Mat33 const &u);
Mat44 transpose(Mat44 const &u);
Mat44 homoTranspose(Mat44 const &u);

Mat22 inverse(Mat22 const &u);
Mat33 inverse(Mat33 const &u);
Mat44 inverse(Mat44 const &u);

Mat22 Mat22Rotation(double theta);
Mat22 Mat22RotationXYPlane(double theta);
Mat33 Mat33Rotation(Vec3 const &axis, double theta);
Mat22 Mat22RotationVector(Vec2 const &src);
Mat33 Mat33RotationVectorToVector(Vec3 const &src, Vec3 const &dst);
Mat33 Mat33RotationXAxis(double theta);
Mat33 Mat33RotationYZPlane(double theta);
Mat33 Mat33RotationYAxis(double theta);
Mat33 Mat33RotationXZPlane(double theta);
Mat33 Mat33RotationZAxis(double theta);
Mat33 Mat33RotationXYPlane(double theta);
Mat44 Mat44RotationXAxis(double theta);
Mat44 Mat44RotationYZPlane(double theta);
Mat44 Mat44RotationYAxis(double theta);
Mat44 Mat44RotationXZPlane(double theta);
Mat44 Mat44RotationZAxis(double theta);
Mat44 Mat44RotationXYPlane(double theta);
Mat44 Mat44RotationXAPlane(double theta);
Mat44 Mat44RotationYAPlane(double theta);
Mat44 Mat44RotationZAPlane(double theta);

Mat44 Mat44Translation(double x, double y, double z);
Mat44 Mat44PerspectiveFov(double fovy, double aspect, double znear, double zfar);
Mat44 Mat44GeneralProjection(double xmon, double ymon, Vec3 const &dvec, double znear, double zfar);
Mat44 Mat44LookAt(Vec3 const &eyepos, Vec3 const &lookat, Vec3 const &up);

Mat33 orthonormalize(Mat33 const &u);

Mat33 alignWithZ(Mat33 const &u, Vec3 const &z_targ, double weight);
Mat33 alignWithY(Mat33 const &u, Vec3 const &y_targ, double weight);
Mat33 alignWithX(Mat33 const &u, Vec3 const &y_targ, double weight) ;

Ea3 toEa(Mat33 const &u);
Mat33 toMat(Ea3 const &u);
Mat33 toMat(Quaternion const &u);
Quaternion toQuat(Ea3 const &u);


Mat22 Mat22Identity();
Mat33 Mat33Identity();
Mat44 Mat44Identity();

Vec2 normalize(Vec2 const &u);
Vec3 normalize(Vec3 const &u);
Vec4 normalize(Vec4 const &u);
Mat22 normalize(Mat22 const &u);
Mat33 normalize(Mat33 const &u);
Mat44 normalize(Mat44 const &u);

double normsq(Vec2 const &u);
double normsq(Vec3 const &u);
double normsq(Vec4 const &u);
double normsq(Mat22 const &u);
double normsq(Mat33 const &u);
double normsq(Mat44 const &u);
double normsq(Ea3 const &u);
double normsq(Quaternion const &u);

double norm(Vec2 const &u);
double norm(Vec3 const &u);
double norm(Vec4 const &u);
double norm(Mat22 const &u);
double norm(Mat33 const &u);
double norm(Mat44 const &u);
double norm(Ea3 const &u);
double norm(Quaternion const &u);

void setRow(Mat22 &u, int ri, Vec2 const &v);
void setCol(Mat22 &u, int ci, Vec2 const &v);
Vec2 getRow(Mat22 const &u, int ri);
Vec2 getCol(Mat22 const &u, int ci);
void setRow(Mat33 &u, int ri, Vec3 const &v);
void setCol(Mat33 &u, int ci, Vec3 const &v);
Vec3 getRow(Mat33 const &u, int ri) ;
Vec3 getCol(Mat33 const &u, int ci);
void setRow(Mat44 &u, int ri, Vec4 const &v);
void setCol(Mat44 &u, int ci, Vec4 const &v);
Vec4 getRow(Mat44 const &u, int ri);
Vec4 getCol(Mat44 const &u, int ci);

Mat33 justRotation(Mat44 const &u);
Vec3 justTranslation(Mat44 const &u);
Mat33 twaddle(Mat33 const &u, double rotsigma, int niter);

double getValue(Polyfit3 const &u, double t);
double getDerivative(Polyfit3 const &u, double t);

#endif

#include "common/std_headers.h"
#include "nodebase/jswrapbase.h"
#include "build.src/vec_jsWrap.h"
#include "build.src/ivec_jsWrap.h"
#include "build.src/mat_jsWrap.h"
#include "build.src/mat44_jsWrap.h"
#include "./solid_geometry_jswrap.h"

using namespace arma;

/* ----------------------------------------------------------------------
   StlSolid
*/

static void jsNew_StlSolid(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (!(args.Holder()->InternalFieldCount() > 0)) {
    return ThrowInvalidThis(isolate);
  }
  auto thisObj = new JsWrap_StlSolid(isolate);
  jsConstructor_StlSolid(thisObj, args);
}


void jsConstructor_StlSolid(JsWrap_StlSolid *thisObj, FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else  {
    return ThrowInvalidArgs(isolate);
  }
  thisObj->Wrap2(args.This());
  args.GetReturnValue().Set(args.This());
}

static void jsGet_StlSolid_bboxLo(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  args.GetReturnValue().Set(JsWrap_vec::MemberInstance(isolate, thisObj->it, &(thisObj->it->bboxLo)));
}

static void jsGet_StlSolid_bboxHi(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  args.GetReturnValue().Set(JsWrap_vec::MemberInstance(isolate, thisObj->it, &(thisObj->it->bboxHi)));
}

static void jsGet_StlSolid_numFaces(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->faces.size()));
}

static void jsWrap_StlSolid_toString(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  args.GetReturnValue().Set(convStringToJs(isolate, oss.str()));
}

static void jsWrap_StlSolid_inspect(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  args.GetReturnValue().Set(convStringToJs(isolate, oss.str()));
}


static void jsWrap_StlSolid_readBinaryFile(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 2 && canConvJsToString(isolate, args[0]) && args[1]->IsNumber()) {
    string a0 = convJsToString(isolate, args[0]);
    double a1 = args[1]->NumberValue();
    FILE *fp = fopen(a0.c_str(), "rb");
    if (!fp) {
      return ThrowRuntimeError(isolate, stringprintf("Can't read %s", a0.c_str()).c_str());
    }
    thisObj->it->readBinaryFile(fp, a1);
    fclose(fp);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_writeBinaryFile(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 2 && canConvJsToString(isolate, args[0]) && args[1]->IsNumber()) {
    string a0 = convJsToString(isolate, args[0]);
    double a1 = args[1]->NumberValue();
    FILE *fp = fopen(a0.c_str(), "wb");
    if (!fp) {
      return ThrowRuntimeError(isolate, stringprintf("Can't write %s", a0.c_str()).c_str());
    }
    thisObj->it->writeBinaryFile(fp, a1);
    fclose(fp);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_transform(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && JsWrap_mat44::Extract(isolate, args[0]) != nullptr) {
    arma::mat44 a0 = *JsWrap_mat44::Extract(isolate, args[0]);
    thisObj->it->transform(a0);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_getStlMassProperties(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    StlMassProperties ret = thisObj->it->getStlMassProperties(a0);
    args.GetReturnValue().Set(JsWrap_StlMassProperties::ConstructInstance(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_getIntersections(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 2 &&
      JsWrap_vec::Extract(isolate, args[0]) != nullptr &&
      JsWrap_vec::Extract(isolate, args[1]) != nullptr) {
    vec a0 = *JsWrap_vec::Extract(isolate, args[0]);
    vec a1 = *JsWrap_vec::Extract(isolate, args[1]);
    vector<StlIntersection> ret = thisObj->it->getIntersections(a0, a1);

    Local<Array> retJs = Array::New(isolate, ret.size());
    for (size_t ri = 0; ri < ret.size(); ri++) {
      Local<Object> interJs = Object::New(isolate);
      interJs->Set(String::NewFromUtf8(isolate, "t"), Number::New(isolate, ret[ri].t));
      interJs->Set(String::NewFromUtf8(isolate, "face"), JsWrap_StlFace::ConstructInstance(isolate, ret[ri].face));
      retJs->Set(ri, interJs);
    }
    args.GetReturnValue().Set(retJs);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_removeTinyFaces(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    thisObj->it->removeTinyFaces(a0);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

struct vecsortwrap {

};

static void jsWrap_StlSolid_exportWebglMesh(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    StlWebglMesh ret = thisObj->it->exportWebglMesh(a0);
    Local<Object> retJs = Object::New(isolate);
    retJs->Set(String::NewFromUtf8(isolate, "coords"), JsWrap_vec::ConstructInstance(isolate, ret.coords));
    retJs->Set(String::NewFromUtf8(isolate, "normals"), JsWrap_vec::ConstructInstance(isolate, ret.normals));
    retJs->Set(String::NewFromUtf8(isolate, "indexes"), JsWrap_ivec::ConstructInstance(isolate, ret.indexes));
    args.GetReturnValue().Set(retJs);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_analyzeHole(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (0) eprintf("StlSolid_analyzeHole thisObj=%p args.Length=%d a0.isNumber=%d\n", thisObj, (int)args.Length(), args[0]->IsNumber());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    arma::vec3 ret = thisObj->it->analyzeHole((int)a0);
    args.GetReturnValue().Set(JsWrap_vec::ConstructInstance(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlSolid_estimateVolume(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 0) {
    auto ret = thisObj->it->estimateVolume();

    Local<Object> retJs = Object::New(isolate);
    retJs->Set(String::NewFromUtf8(isolate, "volume"), Number::New(isolate, ret.first));
    retJs->Set(String::NewFromUtf8(isolate, "center"), JsWrap_vec::ConstructInstance(isolate, ret.second));

    args.GetReturnValue().Set(retJs);
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}



void jsInit_StlSolid(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_StlSolid);
  tpl->SetClassName(String::NewFromUtf8(isolate, "StlSolid"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "bboxLo"), &jsGet_StlSolid_bboxLo);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "bboxHi"), &jsGet_StlSolid_bboxHi);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "numFaces"), &jsGet_StlSolid_numFaces);

  NODE_SET_PROTOTYPE_METHOD(tpl, "toString", &jsWrap_StlSolid_toString);
  NODE_SET_PROTOTYPE_METHOD(tpl, "inspect", &jsWrap_StlSolid_inspect);

  NODE_SET_PROTOTYPE_METHOD(tpl, "readBinaryFile", &jsWrap_StlSolid_readBinaryFile);
  NODE_SET_PROTOTYPE_METHOD(tpl, "writeBinaryFile", &jsWrap_StlSolid_writeBinaryFile);
  NODE_SET_PROTOTYPE_METHOD(tpl, "transform", &jsWrap_StlSolid_transform);
  NODE_SET_PROTOTYPE_METHOD(tpl, "getStlMassProperties", &jsWrap_StlSolid_getStlMassProperties);
  NODE_SET_PROTOTYPE_METHOD(tpl, "getIntersections", &jsWrap_StlSolid_getIntersections);
  NODE_SET_PROTOTYPE_METHOD(tpl, "removeTinyFaces", &jsWrap_StlSolid_removeTinyFaces);
  NODE_SET_PROTOTYPE_METHOD(tpl, "exportWebglMesh", &jsWrap_StlSolid_exportWebglMesh);
  NODE_SET_PROTOTYPE_METHOD(tpl, "analyzeHole", &jsWrap_StlSolid_analyzeHole);
  NODE_SET_PROTOTYPE_METHOD(tpl, "estimateVolume", &jsWrap_StlSolid_estimateVolume);
  JsWrap_StlSolid::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "StlSolid"), tpl->GetFunction());
}

/* ----------------------------------------------------------------------
   StlFace
*/

static void jsNew_StlFace(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (!(args.Holder()->InternalFieldCount() > 0)) return ThrowInvalidThis(isolate);
  JsWrap_StlFace* thisObj = new JsWrap_StlFace(isolate);
  jsConstructor_StlFace(thisObj, args);
}


void jsConstructor_StlFace(JsWrap_StlFace *thisObj, FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else if (args.Length() == 3 &&
           JsWrap_vec::Extract(isolate, args[0]) != nullptr &&
           JsWrap_vec::Extract(isolate, args[1]) != nullptr &&
           JsWrap_vec::Extract(isolate, args[2]) != nullptr) {
    vec a0 = *JsWrap_vec::Extract(isolate, args[0]);
    vec a1 = *JsWrap_vec::Extract(isolate, args[1]);
    vec a2 = *JsWrap_vec::Extract(isolate, args[2]);
    thisObj->assignConstruct(a0, a1, a2);
  }
  else  {
    return ThrowInvalidArgs(isolate);
  }
  thisObj->Wrap2(args.This());
  args.GetReturnValue().Set(args.This());
}

static void jsWrap_StlFace_getArea(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    double ret = thisObj->it->getArea();
    args.GetReturnValue().Set(Number::New(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlFace_getE1(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    vec ret = thisObj->it->getE1();
    args.GetReturnValue().Set(JsWrap_vec::ConstructInstance(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlFace_getE2(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    vec ret = thisObj->it->getE2();
    args.GetReturnValue().Set(JsWrap_vec::ConstructInstance(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlFace_isDegenerate(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    bool ret = thisObj->it->isDegenerate();
    args.GetReturnValue().Set(Boolean::New(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

static void jsWrap_StlFace_getCentroid(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    vec ret = thisObj->it->getCentroid();
    args.GetReturnValue().Set(JsWrap_vec::ConstructInstance(isolate, ret));
  }
  else {
    return ThrowInvalidArgs(isolate);
  }
}

void jsInit_StlFace(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_StlFace);
  tpl->SetClassName(String::NewFromUtf8(isolate, "StlFace"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(tpl, "getArea", &jsWrap_StlFace_getArea);
  NODE_SET_PROTOTYPE_METHOD(tpl, "getE1", &jsWrap_StlFace_getE1);
  NODE_SET_PROTOTYPE_METHOD(tpl, "getE2", &jsWrap_StlFace_getE2);
  NODE_SET_PROTOTYPE_METHOD(tpl, "isDegenerate", &jsWrap_StlFace_isDegenerate);
  NODE_SET_PROTOTYPE_METHOD(tpl, "getCentroid", &jsWrap_StlFace_getCentroid);

  JsWrap_StlFace::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "StlFace"), tpl->GetFunction());
}

/* ----------------------------------------------------------------------
   StlMassProperties
 */

static void jsNew_StlMassProperties(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (!(args.Holder()->InternalFieldCount() > 0)) return ThrowInvalidThis(isolate);
  auto thisObj = new JsWrap_StlMassProperties(isolate);
  jsConstructor_StlMassProperties(thisObj, args);
}


void jsConstructor_StlMassProperties(JsWrap_StlMassProperties *thisObj, FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else  {
    return ThrowInvalidArgs(isolate);
  }
  thisObj->Wrap2(args.This());
  args.GetReturnValue().Set(args.This());
}

static void jsWrap_StlMassProperties_toString(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  args.GetReturnValue().Set(convStringToJs(isolate, oss.str()));
}

static void jsWrap_StlMassProperties_inspect(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  args.GetReturnValue().Set(convStringToJs(isolate, oss.str()));
}


static void jsGet_StlMassProperties_density(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->density));
}

static void jsGet_StlMassProperties_volume(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->volume));
}

static void jsGet_StlMassProperties_mass(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->mass));
}

static void jsGet_StlMassProperties_area(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->area));
}

static void jsGet_StlMassProperties_cm(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(JsWrap_vec::MemberInstance(isolate, thisObj->it, &(thisObj->it->cm)));
}

static void jsGet_StlMassProperties_inertiaOrigin(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(JsWrap_mat::MemberInstance(isolate, thisObj->it, &(thisObj->it->inertiaOrigin)));
}

static void jsGet_StlMassProperties_inertiaCm(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(JsWrap_mat::MemberInstance(isolate, thisObj->it, &(thisObj->it->inertiaCm)));
}

static void jsGet_StlMassProperties_rogOrigin(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(JsWrap_mat::MemberInstance(isolate, thisObj->it, &(thisObj->it->rogOrigin)));
}

static void jsGet_StlMassProperties_rogCm(Local<String> /*name*/, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  auto thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  args.GetReturnValue().Set(JsWrap_mat::MemberInstance(isolate, thisObj->it, &(thisObj->it->rogCm)));
}

void jsInit_StlMassProperties(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_StlMassProperties);
  tpl->SetClassName(String::NewFromUtf8(isolate, "StlMassProperties"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  NODE_SET_PROTOTYPE_METHOD(tpl, "toString", &jsWrap_StlMassProperties_toString);
  NODE_SET_PROTOTYPE_METHOD(tpl, "inspect", &jsWrap_StlMassProperties_inspect);

  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "density"), &jsGet_StlMassProperties_density);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "volume"), &jsGet_StlMassProperties_volume);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "mass"), &jsGet_StlMassProperties_mass);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "area"), &jsGet_StlMassProperties_area);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "cm"), &jsGet_StlMassProperties_cm);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "inertiaOrigin"), &jsGet_StlMassProperties_inertiaOrigin);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "inertiaCm"), &jsGet_StlMassProperties_inertiaCm);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "rogOrigin"), &jsGet_StlMassProperties_rogOrigin);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "rogCm"), &jsGet_StlMassProperties_rogCm);

  JsWrap_StlMassProperties::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "StlMassProperties"), tpl->GetFunction());
}






void jsInit_solid_geometry(Handle<Object> exports) {
  jsInit_StlSolid(exports);
  jsInit_StlFace(exports);
  jsInit_StlMassProperties(exports);
}

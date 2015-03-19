#include "tlbcore/common/std_headers.h"
#include "tlbcore/nodeif/jswrapbase.h"
#include "build.src/vec_jsWrap.h"
#include "build.src/ivec_jsWrap.h"
#include "build.src/mat_jsWrap.h"
#include "./solid_geometry_jswrap.h"

using namespace arma;

/* ----------------------------------------------------------------------
   StlSolid
*/

static Handle<Value> jsNew_StlSolid(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_StlSolid* thisObj = new JsWrap_StlSolid();
  return jsConstructor_StlSolid(thisObj, args);
}


Handle<Value> jsConstructor_StlSolid(JsWrap_StlSolid *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

static Handle<Value> jsGet_StlSolid_bboxLo(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(ai.This());
  return scope.Close(JsWrap_vec::MemberInstance(thisObj->it, &(thisObj->it->bboxLo)));
}

static Handle<Value> jsGet_StlSolid_bboxHi(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(ai.This());
  return scope.Close(JsWrap_vec::MemberInstance(thisObj->it, &(thisObj->it->bboxHi)));
}

static Handle<Value> jsGet_StlSolid_numFaces(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(ai.This());
  return scope.Close(Number::New(thisObj->it->faces.size()));
}

static Handle<Value> jsWrap_StlSolid_toString(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  return scope.Close(convStringToJs(oss.str()));
}

static Handle<Value> jsWrap_StlSolid_inspect(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  return scope.Close(convStringToJs(oss.str()));
}


static Handle<Value> jsWrap_StlSolid_readBinaryFile(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 2 && canConvJsToString(args[0]) && args[1]->IsNumber()) {
    string a0 = convJsToString(args[0]);
    double a1 = args[1]->NumberValue();
    FILE *fp = fopen(a0.c_str(), "rb");
    if (!fp) {
      return ThrowRuntimeError(stringprintf("Can't read %s", a0.c_str()).c_str());
    }
    thisObj->it->readBinaryFile(fp, a1);
    fclose(fp);
    return scope.Close(Undefined());
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlSolid_getStlMassProperties(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    StlMassProperties ret = thisObj->it->getStlMassProperties(a0);
    return scope.Close(JsWrap_StlMassProperties::NewInstance(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlSolid_getIntersections(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 2 && 
      JsWrap_vec::Extract(args[0]) != NULL &&
      JsWrap_vec::Extract(args[1]) != NULL) {
    vec a0 = *JsWrap_vec::Extract(args[0]);
    vec a1 = *JsWrap_vec::Extract(args[1]);
    vector<StlIntersection> ret = thisObj->it->getIntersections(a0, a1);

    Local<Array> retJs = Array::New(ret.size());
    for (size_t ri = 0; ri < ret.size(); ri++) {
      Local<Object> interJs = Object::New();
      interJs->Set(String::NewSymbol("t"), Number::New(ret[ri].t));
      interJs->Set(String::NewSymbol("face"), JsWrap_StlFace::NewInstance(ret[ri].face));
      retJs->Set(ri, interJs);
    }
    return scope.Close(retJs);
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlSolid_removeTinyFaces(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    thisObj->it->removeTinyFaces(a0);
    return scope.Close(Undefined());
  }
  else {
    return ThrowInvalidArgs();
  }
}

struct vecsortwrap {
  
};

static Handle<Value> jsWrap_StlSolid_exportWebglMesh(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 0) {
    StlWebglMesh ret = thisObj->it->exportWebglMesh();
    Local<Object> retJs = Object::New();
    retJs->Set(String::NewSymbol("coords"), JsWrap_vec::NewInstance(ret.coords));
    retJs->Set(String::NewSymbol("indexes"), JsWrap_ivec::NewInstance(ret.indexes));
    return scope.Close(retJs);
  }
  else {
    return ThrowInvalidArgs();
  }
}



void jsInit_StlSolid(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_StlSolid);
  tpl->SetClassName(String::NewSymbol("StlSolid"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("bboxLo"), &jsGet_StlSolid_bboxLo);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("bboxHi"), &jsGet_StlSolid_bboxHi);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("numFaces"), &jsGet_StlSolid_numFaces);

  tpl->PrototypeTemplate()->Set(String::NewSymbol("toString"), FunctionTemplate::New(jsWrap_StlSolid_toString)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("inspect"), FunctionTemplate::New(jsWrap_StlSolid_inspect)->GetFunction());

  tpl->PrototypeTemplate()->Set(String::NewSymbol("readBinaryFile"), FunctionTemplate::New(jsWrap_StlSolid_readBinaryFile)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("getStlMassProperties"), FunctionTemplate::New(jsWrap_StlSolid_getStlMassProperties)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("getIntersections"), FunctionTemplate::New(jsWrap_StlSolid_getIntersections)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("removeTinyFaces"), FunctionTemplate::New(jsWrap_StlSolid_removeTinyFaces)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("exportWebglMesh"), FunctionTemplate::New(jsWrap_StlSolid_exportWebglMesh)->GetFunction());
  
  JsWrap_StlSolid::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("StlSolid"), JsWrap_StlSolid::constructor);
}

/* ----------------------------------------------------------------------
   StlFace
*/

static Handle<Value> jsNew_StlFace(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_StlFace* thisObj = new JsWrap_StlFace();
  return jsConstructor_StlFace(thisObj, args);
}


Handle<Value> jsConstructor_StlFace(JsWrap_StlFace *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else if (args.Length() == 3 && 
           JsWrap_vec::Extract(args[0]) != NULL &&
           JsWrap_vec::Extract(args[1]) != NULL &&
           JsWrap_vec::Extract(args[2]) != NULL) {
    vec a0 = *JsWrap_vec::Extract(args[0]);
    vec a1 = *JsWrap_vec::Extract(args[1]);
    vec a2 = *JsWrap_vec::Extract(args[2]);
    thisObj->assignConstruct(a0, a1, a2);
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

static Handle<Value> jsWrap_StlFace_getArea(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlFace* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    double ret = thisObj->it->getArea();
    return scope.Close(Number::New(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlFace_getE1(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlFace* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    vec ret = thisObj->it->getE1();
    return scope.Close(JsWrap_vec::NewInstance(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlFace_getE2(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlFace* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    vec ret = thisObj->it->getE2();
    return scope.Close(JsWrap_vec::NewInstance(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlFace_isDegenerate(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlFace* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    bool ret = thisObj->it->isDegenerate();
    return scope.Close(Boolean::New(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlFace_getCentroid(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlFace* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlFace>(args.This());
  if (args.Length() == 0) {
    vec ret = thisObj->it->getCentroid();
    return scope.Close(JsWrap_vec::NewInstance(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

void jsInit_StlFace(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_StlFace);
  tpl->SetClassName(String::NewSymbol("StlFace"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->Set(String::NewSymbol("getArea"), FunctionTemplate::New(jsWrap_StlFace_getArea)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("getE1"), FunctionTemplate::New(jsWrap_StlFace_getE1)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("getE2"), FunctionTemplate::New(jsWrap_StlFace_getE2)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("isDegenerate"), FunctionTemplate::New(jsWrap_StlFace_isDegenerate)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("getCentroid"), FunctionTemplate::New(jsWrap_StlFace_getCentroid)->GetFunction());
  
  JsWrap_StlFace::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("StlFace"), JsWrap_StlFace::constructor);
}

/* ----------------------------------------------------------------------
   StlMassProperties
 */

static Handle<Value> jsNew_StlMassProperties(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_StlMassProperties* thisObj = new JsWrap_StlMassProperties();
  return jsConstructor_StlMassProperties(thisObj, args);
}


Handle<Value> jsConstructor_StlMassProperties(JsWrap_StlMassProperties *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

static Handle<Value> jsWrap_StlMassProperties_toString(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  return scope.Close(convStringToJs(oss.str()));
}

static Handle<Value> jsWrap_StlMassProperties_inspect(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(args.This());
  ostringstream oss;
  oss << *thisObj->it;
  return scope.Close(convStringToJs(oss.str()));
}


static Handle<Value> jsGet_StlMassProperties_density(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->density));
}

static Handle<Value> jsGet_StlMassProperties_volume(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->volume));
}

static Handle<Value> jsGet_StlMassProperties_mass(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->mass));
}

static Handle<Value> jsGet_StlMassProperties_area(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->area));
}

static Handle<Value> jsGet_StlMassProperties_cm(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_vec::MemberInstance(thisObj->it, &(thisObj->it->cm)));
}

static Handle<Value> jsGet_StlMassProperties_inertiaOrigin(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::MemberInstance(thisObj->it, &(thisObj->it->inertiaOrigin)));
}

static Handle<Value> jsGet_StlMassProperties_inertiaCm(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::MemberInstance(thisObj->it, &(thisObj->it->inertiaCm)));
}

static Handle<Value> jsGet_StlMassProperties_rogOrigin(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::MemberInstance(thisObj->it, &(thisObj->it->rogOrigin)));
}

static Handle<Value> jsGet_StlMassProperties_rogCm(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::MemberInstance(thisObj->it, &(thisObj->it->rogCm)));
}

void jsInit_StlMassProperties(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_StlMassProperties);
  tpl->SetClassName(String::NewSymbol("StlMassProperties"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->Set(String::NewSymbol("toString"), FunctionTemplate::New(jsWrap_StlMassProperties_toString)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("inspect"), FunctionTemplate::New(jsWrap_StlMassProperties_inspect)->GetFunction());

  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("density"), &jsGet_StlMassProperties_density);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("volume"), &jsGet_StlMassProperties_volume);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("mass"), &jsGet_StlMassProperties_mass);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("area"), &jsGet_StlMassProperties_area);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("cm"), &jsGet_StlMassProperties_cm);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("inertiaOrigin"), &jsGet_StlMassProperties_inertiaOrigin);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("inertiaCm"), &jsGet_StlMassProperties_inertiaCm);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("rogOrigin"), &jsGet_StlMassProperties_rogOrigin);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("rogCm"), &jsGet_StlMassProperties_rogCm);

  JsWrap_StlMassProperties::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("StlMassProperties"), JsWrap_StlMassProperties::constructor);
}






void jsInit_solid_geometry(Handle<Object> exports) {
  jsInit_StlSolid(exports);
  jsInit_StlFace(exports);
  jsInit_StlMassProperties(exports);
}

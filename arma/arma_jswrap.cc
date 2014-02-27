#include "../common/std_headers.h"
#include "../nodeif/jswrapbase.h"
#include "./arma_jswrap.h"

using namespace arma;

static Handle<Value> jsNew_mat(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_mat* thisObj = new JsWrap_mat();
  return jsConstructor_mat(thisObj, args);
}


Handle<Value> jsConstructor_mat(JsWrap_mat *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 0) {
    thisObj->assign();
  }
  else if (args.Length() == 1 && JsWrap_mat::Extract(args[0])) {
    mat *other = JsWrap_mat::Extract(args[0]);
    thisObj->assign(mat(*other));
  }
  else if (args.Length() == 1 && JsWrap_vec::Extract(args[0])) {
    vec *other = JsWrap_vec::Extract(args[0]);
    thisObj->assign(mat(*other));
  }
  // WRITEME: mat([[1,2,3],[4,5,6],[7,8,9]])
  else if (args.Length() == 2 && args[0]->IsNumber() && args[1]->IsNumber()) {
    size_t nr = (size_t)args[0]->NumberValue();
    size_t nc = (size_t)args[1]->NumberValue();
    thisObj->assign(mat(nr, nc, fill::zeros));
  }
  else if (args.Length() == 3 && args[0]->IsNumber() && args[1]->IsNumber() && args[2]->IsString()) {
    size_t nr = (size_t)args[0]->NumberValue();
    size_t nc = (size_t)args[1]->NumberValue();
    string fill_type = convJsToString(args[1]);
    
    if (fill_type == "zeros") {
      thisObj->assign(mat(nr, nc, fill::zeros));
    }
    else if (fill_type == "ones") {
      thisObj->assign(mat(nr, nc, fill::ones));
    }
    else if (fill_type == "eye") {
      thisObj->assign(mat(nr, nc, fill::eye));
    }
    else if (fill_type == "randu") {
      thisObj->assign(mat(nr, nc, fill::randu));
    }
    else if (fill_type == "randn") {
      thisObj->assign(mat(nr, nc, fill::randn));
    }
    else if (fill_type == "none") {
      thisObj->assign(mat(nr, nc, fill::none));
    }
    else {
      return ThrowInvalidArgs();
    }
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

Handle<Value> jsWrap_mat_eye(Arguments const &args) {
  HandleScope scope;
  if (args.Length() == 2 && args[0]->IsNumber() && args[1]->IsNumber()) {
    size_t nr = (size_t)args[0]->NumberValue();
    size_t nc = (size_t)args[1]->NumberValue();
    mat ret = eye<mat>(nr, nc);
    return scope.Close(JsWrap_mat::NewInstance(ret));
  }
  else  {
    return ThrowInvalidArgs();
  }
}

Handle<Value> jsWrap_mat_linspace(Arguments const &args) {
  HandleScope scope;
  if (args.Length() == 3 && args[0]->IsNumber() && args[1]->IsNumber() && args[1]->IsNumber()) {
    double start = args[0]->NumberValue();
    double end = args[1]->NumberValue();
    size_t n = (size_t)args[2]->NumberValue();
    mat ret = linspace<mat>(start, end, n);
    return scope.Close(JsWrap_mat::NewInstance(ret));
  }
  else  {
    return ThrowInvalidArgs();
  }
}

void jsInit_mat(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_mat);
  tpl->SetClassName(String::NewSymbol("mat"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  JsWrap_mat::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("mat"), JsWrap_mat::constructor);

  JsWrap_mat::constructor->Set(String::NewSymbol("eye"), FunctionTemplate::New(jsWrap_mat_eye)->GetFunction());
  JsWrap_mat::constructor->Set(String::NewSymbol("linspace"), FunctionTemplate::New(jsWrap_mat_linspace)->GetFunction());
}

// ----------------------------------------------------------------------

static Handle<Value> jsNew_vec(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_vec* thisObj = new JsWrap_vec();
  return jsConstructor_vec(thisObj, args);
}


Handle<Value> jsConstructor_vec(JsWrap_vec *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 1 && args[0]->IsNumber()) {
    size_t ne = (size_t)args[0]->NumberValue();
    thisObj->assign(vec(ne));
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

Handle<Value> jsWrap_vec_linspace(Arguments const &args) {
  HandleScope scope;
  if (args.Length() == 3 && args[0]->IsNumber() && args[1]->IsNumber() && args[1]->IsNumber()) {
    double start = args[0]->NumberValue();
    double end = args[1]->NumberValue();
    size_t n = (size_t)args[2]->NumberValue();
    vec ret = linspace<vec>(start, end, n);
    return scope.Close(JsWrap_vec::NewInstance(ret));
  }
  else  {
    return ThrowInvalidArgs();
  }
}


// ----------------------------------------------------------------------

void jsInit_vec(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_vec);
  tpl->SetClassName(String::NewSymbol("vec"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  JsWrap_vec::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("vec"), JsWrap_vec::constructor);

  JsWrap_vec::constructor->Set(String::NewSymbol("linspace"), FunctionTemplate::New(jsWrap_vec_linspace)->GetFunction());
}

void jsInit_arma(Handle<Object> exports) {
  jsInit_vec(exports);
  jsInit_mat(exports);
}



static void init(Handle<Object> exports) {
  jsInit_arma(exports);
}

NODE_MODULE(arma, init);

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

#include "../common/std_headers.h"
#include "./jswrapbase.h"


Handle<Value> ThrowInvalidArgs() {
  return ThrowException(Exception::TypeError(String::New("Invalid arguments")));
}

Handle<Value> ThrowInvalidThis() {
  return ThrowException(Exception::TypeError(String::New("Invalid this, did you forget to call new?")));
}

Handle<Value> ThrowTypeError(char const *s) {
  return ThrowException(Exception::TypeError(String::New(s)));
}


string convJsStringToStl(Handle<String> it) {
  String::Utf8Value v8str(it);
  return string((char *) *v8str, v8str.length());
}

Handle<Value> convStlStringToJs(string const &it) {
  return String::New(it.data(), it.size());
}



/* ----------------------------------------------------------------------
   Convert JS arrays, both regular and native, to vector<double>
   See https://github.com/joyent/node/issues/4201 for details on native arrays
*/

vector<double> convJsToDoubleVector(Handle<Object> it) {
  if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray) {
    size_t itLen = it->GetIndexedPropertiesExternalArrayDataLength();
    double* itData = static_cast<double*>(it->GetIndexedPropertiesExternalArrayData());

    return vector<double>(itData, itData+itLen);
  }

  if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalFloatArray) {
    size_t itLen = it->GetIndexedPropertiesExternalArrayDataLength();
    float* itData = static_cast<float*>(it->GetIndexedPropertiesExternalArrayData());

    return vector<double>(itData, itData+itLen);
  }

  // Also handle regular JS arrays
  if (it->IsArray()) {
    Handle<Array> itArr = Handle<Array>::Cast(it);
    size_t itArrLen = itArr->Length();
    vector<double> ret(itArrLen);
    for (size_t i=0; i<itArrLen; i++) {
      ret[i] = itArr->Get(i)->NumberValue();
    }
    return ret;
  }

  throw new tlbcore_type_err("convJsToDoubleVector: not an array");
}

Handle<Object> convDoubleVectorToJs(vector<double> const &it) {
  static Persistent<Function> float64_array_constructor;

  if (float64_array_constructor.IsEmpty()) {
    Local<Object> global = Context::GetCurrent()->Global();
    Local<Value> val = global->Get(String::New("Float64Array"));
    assert(!val.IsEmpty() && "type not found: Float64Array");
    assert(val->IsFunction() && "not a constructor: Float64Array");
    float64_array_constructor = Persistent<Function>::New(val.As<Function>());
  }

  Local<Value> itSize = Integer::NewFromUnsigned((u_int)it.size());
  Local<Object> ret = float64_array_constructor->NewInstance(1, &itSize);
  assert(ret->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray);
  assert((size_t)ret->GetIndexedPropertiesExternalArrayDataLength() == it.size());

  double* retData = static_cast<double*>(ret->GetIndexedPropertiesExternalArrayData());
  memcpy(retData, &it[0], it.size() * sizeof(double));
  
  return ret;
}

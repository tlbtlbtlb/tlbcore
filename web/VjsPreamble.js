
var modules = {};

function require(name) {
  if (!(name in modules)) {
    var exports = {};
    modules[name] = {name: name, exports: exports};
    window[name] = exports;
    if (console) console.log('require(' + name + ') before load');
  }
  return window[name];
}

/*
  f should be function(exports, require, module, __filename) {...}
*/
function defmodule(name, f) {
  if (!(name in modules)) {
    var exports = {};
    modules[name] = {name: name, exports: exports};
    window[name] = exports;
  }
  var module = modules[name];
  var ret = f(module.exports, require, module, name);
  window[name] = module.exports;  // In case f assigns module.exports = ...
}

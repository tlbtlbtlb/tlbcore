/* eslint-disable strict */
let modules = {};

function require(name) {
  let slashI = name.lastIndexOf('/');
  if (slashI !== -1) name = name.substr(slashI+1);
  if (!(name in modules)) {
    let exports = {};
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
    let exports = {};
    modules[name] = {name: name, exports: exports};
    window[name] = exports;
  }
  let module = modules[name];
  let ret = f.call(window, module.exports, require, module, name);
  window[name] = module.exports;  // In case f assigns module.exports = ...
}

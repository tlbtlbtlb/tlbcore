'use strict';
var _                   = require('underscore');
var util                = require('util');
var cgen                = require('./cgen');
var assert              = require('assert');
var fs                  = require('fs');

exports.RtFunction = RtFunction;


function RtFunction(typereg, name, inargs, outargs, assigns) {
  this.typereg = typereg;
  this.name = name;
  this.inargs = inargs;
  this.outargs = outargs;
  this.assigns = assigns || [];
  this.checkArgs();
  this.registerWrapper();
}

RtFunction.prototype.writeToFile = function(fn, onDone) {
  var s = JSON.stringify({typereg: this.typereg, name: this.name, inargs: this.inargs, outargs: this.outargs, assigns: this.assigns});
  fs.writeFile(fn, s, function(err) {
    if (err) console.log(fn + ': write failed');
    if (onDone) onDone();
  });
};

RtFunction.readFromFile = function(fn, onDone) {
  var s = fs.readFile(fn, function(err, s) {
    if (err) console.log(fn + ': read failed');
    var o = JSON.parse(s);
    var rtfn = new RtFunction(o.typereg, o.name, o.inargs, o.outargs, o.assigns);
    onDone(rtfn);
  });
};

RtFunction.prototype.checkArgs = function() {
  var self = this;
  _.each(self.inargs, function(argtype, argname) {
    assert.ok(argtype in self.typereg.types);
  });
  _.each(self.outargs, function(argtype, argname) {
    assert.ok(argtype in self.typereg.types);
  });
};

RtFunction.prototype.registerWrapper = function() {
  var self = this;

  // This is complicated because in an RtFunction the inargs & outargs are just {name:type}, but the wrap function takes the args explicitely
  // in order and with 
  self.typereg.addWrapFunction(self.getSignature(), '', self.name, '', 'void', self.collectArgs(function(argname, argTypename, isOut) {
    return {typename: argTypename, passing: isOut ? '&' : 'const &'};
  }));
};

RtFunction.prototype.collectArgs = function(argFunc) {
  var self = this;
  return _.map(_.sortBy(_.keys(self.inargs), _.identity), function(argname) {
    var argTypename = self.inargs[argname];
    return argFunc(argname, argTypename, false);
  }).concat(_.map(_.sortBy(_.keys(self.outargs), _.identity), function(argname) {
    var argTypename = self.outargs[argname];
    return argFunc(argname, argTypename, true);
  }));
};

RtFunction.prototype.getAllTypes = function() {
  return _.uniq(_.values(this.inargs).concat(_.values(this.outargs)));
};

RtFunction.prototype.getSignature = function() {
  var self = this;
  return ('void ' + self.name + '(' + self.collectArgs(function(argname, argTypename, isOut) {
    return argTypename + (isOut ? ' &' : ' const &') + argname;
  }).join(', ') + ')');
};

RtFunction.prototype.emitDecl = function(l) {
  l(this.getSignature() + ';');
};


RtFunction.prototype.emitDefn = function(l) {
  var self = this;
  l(self.getSignature() + ' {');
  _.each(self.assigns, 
  emitAssigns(l, this.assigns);
  l('}');
  l('');
};


RtFunction.prototype.addAssign = function(e) {
  this.assigns.push(e);
};


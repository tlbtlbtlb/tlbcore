var _                   = require('underscore');
var util                = require('util');
var cgen                = require('./cgen');
var assert              = require('assert');
var fs                  = require('fs');

exports.RtFunction = RtFunction;


function RtFunction(typereg, name, inargs, outargs, nodes) {
  this.typereg = typereg;
  this.name = name;
  this.inargs = inargs;
  this.outargs = outargs;
  this.nodes = nodes || [];
  this.checkArgs();
  this.registerWrapper();
}

RtFunction.prototype.writeToFile = function(fn, onDone) {
  var s = JSON.stringify({typereg: this.typereg, name: this.name, inargs: this.inargs, outargs: this.outargs, nodes: this.nodes});
  fs.writeFile(fn, s, function(err) {
    if (err) console.log(fn + ': write failed');
    if (onDone) onDone();
  });
};

RtFunction.readFromFile = function(fn, onDone) {
  var s = fs.readFile(fn, function(err, s) {
    if (err) console.log(fn + ': read failed');
    var o = JSON.parse(s);
    var rtfn = new RtFunction(o.typereg, o.name, o.inargs, o.outargs, o.nodes);
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
  l(this.getSignature() + ' {');
  emitNodes(l, this.nodes);
  l('}');
  l('');
};


RtFunction.prototype.node = function(type, parms, srcs, dsts) {
  var n = new ExprNode(type, parms, srcs, dsts);
  this.nodes.push(n);
  return n;
};



function ExprNode(type, parms, srcs, dsts) {
    this.type = type;
    this.parms = parms;
    this.srcs = srcs;
    this.dsts = dsts;
    this.annotations = {};
}

function emitNodes(l, nodes) {

  var deps = {};
  _.each(nodes, function(node, ni) {
    _.each(node.dsts, function(dst) {
      if (deps[dst]) throw new TypeError('Multiple deps for ' + dst);
      deps[dst] = ni;
    });
  });

  var doneNodes = _.map(_.range(0, nodes.length), function(ni) { return 0; } );

  _.each(_.range(0, nodes.length), function(i) {
    emitNodeIndex(i);
  });
  
  function emitNodeIndex(nodei) {
    if (doneNodes[nodei] === 2) return;
    if (doneNodes[nodei] === 1) throw new TypeError('Circular dependency for ' + nodes[nodei]);

    doneNodes[nodei] = 1;
    _.each(nodes[nodei].srcs, function(src) {
      if (src in deps) emitNodeIndex(deps[src]);
    });
    emitNode(l, nodes[nodei]);
    doneNodes[nodei] = 2;
  }
}

function emitNode(l, node) {
    var a,b;
    
    switch (node.type) {

    case 'scalar.copy':
        l(node.dsts[0] + ' = ' + node.srcs[0] + ';');
        break;
    case 'vec3.copy':
        l(node.dsts[0] + '.x = ' + node.srcs[0] + '.x;');
        l(node.dsts[0] + '.y = ' + node.srcs[0] + '.y;');
        l(node.dsts[0] + '.z = ' + node.srcs[0] + '.z;');
        break;
    case 'complex.copy':
        l(node.dsts[0] + '.re = ' + node.srcs[0] + '.re;');
        l(node.dsts[0] + '.im = ' + node.srcs[0] + '.im;');
        break;

    case 'scalar.const':
        l(node.dsts[0] + ' = ' + JSON.stringify(node.parms[0]) + ';');
        break;
    case 'vec3.const':
        l(node.dsts[0] + '.x = ' + JSON.stringify(node.parms[0]) + ';');
        l(node.dsts[0] + '.y = ' + JSON.stringify(node.parms[1]) + ';');
        l(node.dsts[0] + '.z = ' + JSON.stringify(node.parms[2]) + ';');
        break;
    case 'complex.const':
        l(node.dsts[0] + '.re = ' + JSON.stringify(node.parms[0]) + ';');
        l(node.dsts[0] + '.im = ' + JSON.stringify(node.parms[1]) + ';');
        break;
        
    case 'scalar.+':
        l(node.dsts[0] + ' = ' + node.srcs[0] + ' + ' + node.srcs[1] + ';');
        break;
    case 'scalar.-':
        l(node.dsts[0] + ' = ' + node.srcs[0] + ' - ' + node.srcs[1] + ';');
        break;
    case 'scalar.*':
        l(node.dsts[0] + ' = ' + node.srcs[0] + ' * ' + node.srcs[1] + ';');
        break;
    case 'scalar./':
        l(node.dsts[0] + ' = ' + node.srcs[0] + ' / ' + node.srcs[1] + ';');
        break;

    case 'scalar.poly':
      l(node.dsts[0] + ' = ' +
        _.map(node.parms, function(p, pi) {
          if (pi === node.parms.length-1) return p.toString();
          return '(' + p.toString() + ' + ' + node.srcs[0] + ' * '; 
        }).join('') +
        _.map(node.parms, function(p, pi) { 
          if (pi === node.parms.length-1) return '';
          return ')'; 
        }).join('') + ';');
      break;
      
    case 'vec3.+':
        l(node.dsts[0] + '.x = ' + node.srcs[0] + '.x + ' + node.srcs[1] + '.x;');
        l(node.dsts[0] + '.y = ' + node.srcs[0] + '.y + ' + node.srcs[1] + '.y;');
        l(node.dsts[0] + '.z = ' + node.srcs[0] + '.z + ' + node.srcs[1] + '.z;');
        break;
        
    case 'scalar.sin':
        l(node.dsts[0] + ' = sin(' + node.srcs[0] + ');');
        break;
    case 'scalar.cos':
        l(node.dsts[0] + ' = cos(' + node.srcs[0] + ');');
        break;
    case 'scalar.tan':
        l(node.dsts[0] + ' = tan(' + node.srcs[0] + ');');
        break;
    case 'scalar.atan2':
        l(node.dsts[0] + ' = atan2(' + node.srcs[0] + ', ' + node.srcs[1] + ');');
        break;

    case 'scalar.exp':
        l(node.dsts[0] + ' = exp(' + node.srcs[0] + ');');
        break;
    case 'scalar.log':
        l(node.dsts[0] + ' = log(' + node.srcs[0] + ');');
        break;

    case 'scalar.sigmoid':
        l(node.dsts[0] + ' = sigmoid(' + node.srcs[0] + ');');
        break;
    case 'scalar.atan':
        l(node.dsts[0] + ' = atan(' + node.srcs[0] + ');');
        break;
    case 'erf':
        // WRITEME: erf http://en.wikipedia.org/wiki/Error_function
      throw new Error('erf unimplemented');
      break;

    }
}

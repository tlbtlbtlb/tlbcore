'use strict';
const _ = require('lodash');

_.mixin({
  isHash: function(it) {
    return _.isObject(it) && !_.isFunction(it) && !_.isArray(it);
  },
  isEmptyObject: function(a) {
    let k;
    if (_.isObject(a)) {
      for (k in a) {
        if (a.hasOwnProperty(k)) return false;
      }
      return true;
    }
    return false;
  },
  isNonemptyObject: function(a) {
    let k;
    if (_.isObject(a)) {
      for (k in a) {
        if (a.hasOwnProperty(k)) return true;
      }
    }
    return false;
  }
});

_.mixin({
  /*
    For all the differences between the arrays oldSet and newSet, call the (optional) functions.
    oldSet and newSet should be arrays of items, which are sorted and compared by lexicographic string value.
    However, the actual value is used when calling the callbacks.
    If you want something different, you should probably roll your own.
    Doesn't change oldSet or newSet.
  */
  setDiffMap: function(oldSet, newSet, remFunc, addFunc, sameFunc) {
    oldSet = oldSet.concat();
    newSet = newSet.concat();
    oldSet.sort();
    newSet.sort();

    let oldi = 0, newi = 0;
    while (oldi < oldSet.length || newi < newSet.length) {
      if (oldi === oldSet.length) {
        addFunc(newSet[newi]);
        newi ++;
      }
      else if (newi === newSet.length) {
        remFunc(oldSet[oldi]);
        oldi ++;
      }
      else {
        let o = oldSet[oldi];
        let os = o.toString();
        let n = newSet[newi];
        let ns = n.toString();

        if (os < ns) {
          if (remFunc) remFunc(o);
          oldi ++;
        }
        else if (ns < os) {
          if (addFunc) addFunc(n);
          newi ++;
        }
        else {
          if (sameFunc) sameFunc(n);
          oldi ++;
          newi ++;
        }
      }
    }
  },

  setDiff: function(a, b) {
    let ret = {aNotB: [], bNotA: [], aAndB: []};
    _.setDiffMap(a, b,
                 function(x) {
                   ret.aNotB.push(x);
                 },
                 function(x) {
                   ret.bNotA.push(x);
                 },
                 function(x) {
                   ret.aAndB.push(x);
                 });
    return ret;
  }
});



_.mixin({
  fmt3: function(x) {
    if (x === undefined || x === null) {
      return "";
    }
    if (x.length && typeof x.length === 'number') {
      return '[' + _.map(x, _.fmt3).join(' ') + ']';
    }
    if (_.isFunction(x.inspect)) {
      return x.inspect(0);
    }
    return (x < 0 ? '' : '+') + x.toFixed(3);
  },

  fmt6: function(x) {
    if (x === undefined || x === null) {
      return "";
    }
    if (x.length && typeof x.length === 'number') {
      return '[' + _.map(x, _.fmt6).join(' ') + ']';
    }
    return (x < 0 ? '' : '+') + x.toFixed(6);
  }
});

_.mixin({
  nameCompare: function(a, b) {
    let as = a.replace(/0*(\d+)/, function(ns) {
      return String.fromCharCode(1000+ns.length) + ns;
    });
    let bs = b.replace(/0*(\d+)/, function(ns) {
      return String.fromCharCode(1000+ns.length) + ns;
    });
    if (as > bs) return 1;
    if (as < bs) return -1;
    return 0;
  }
});

_.mixin({

  randomNormal: function() {
    let v1, v2, r, fac;
    do {
      v1 = 2.0*Math.random() - 1.0;
      v2 = 2.0*Math.random() - 1.0;
      r = v1*v1 + v2*v2;
    } while (r >= 1.0);
    fac = Math.sqrt(-2.0 * Math.log(r)/r);

    return v1 * fac;
  },

  randomExponential: function() {
    return -Math.log(Math.random());
  },

  normangle: function(x) {
    return (x % (Math.PI*2) + (Math.PI*3)) % (Math.PI*2) - Math.PI;
  },

  normanglepos: function(x) {
    return (x % (Math.PI*2) + (Math.PI*2)) % (Math.PI*2);
  },

  sqr: function(x) {
    return x*x;
  },

  sign: function(x) {
    if (x < 0) return -1;
    if (x > 0) return 1;
    return 0;
  }
});


_.mixin({
  // Quote a string for literal matching inside a regexp
  requote: function(s) {
    return s.replace(/[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g, "\\$&");
  }
});

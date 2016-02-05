'use strict';
var _                   = require('underscore');

_.mixin({
  isHash: function(it) {
    return _.isObject(it) && !_.isFunction(it) && !_.isArray(it);
  },
  isEmptyObject: function(a) {
    var k;
    if (_.isObject(a)) {
      for (k in a) {
        if (a.hasOwnProperty(k)) return false;
      }
      return true;
    }
    return false;
  },
  isNonemptyObject: function(a) {
    var k;
    if (_.isObject(a)) {
      for (k in a) {
        if (a.hasOwnProperty(k)) return true;
      }
    }
    return false;
  }
});

_.mixin({
  arrayMapPar: function(todos, func, cb, maxPar) {

    if (!maxPar) maxPar = 20;

    var ret = {};

    if (!todos.length) {
      var cb1 = cb;
      cb = null;
      if (cb1) cb1(ret);
      return;
    }

    var todoi = 0;
    var numActive = 0;

    function startNext() {
      if (numActive < maxPar && todoi < todos.length) {
        numActive ++;
        var todo = todos[todoi++];
        func(todo, function(ret1) {
          ret[todo] = ret1;
          numActive --;
          startNext();
          startNext();
        });
      }
      if (numActive === 0 && todoi === todos.length) {
        var cb1 = cb;
        cb = null;
        if (cb1) cb1(ret);
      }
    }

    for (var i=0; i<maxPar; i++) {
      startNext();
    }
  },

  arrayRunPar: function(todos, cb, maxPar) {
    _.arrayMapPar(todos, function(f, cb1) {f(cb1); }, cb, maxPar);
  },

  arrayMapSer: function(todos, func, cb) {
    _.arrayMapPar(todos, func, cb, 1);
  },

  arrayRunSer: function(todos, cb) {
    _.arrayMapSer(todos, function(f, cb1) {f(cb1); }, cb);
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

    var oldi = 0, newi = 0;
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
        var o = oldSet[oldi];
        var os = o.toString();
        var n = newSet[newi];
        var ns = n.toString();

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
    var ret = {aNotB: [], bNotA: [], aAndB: []};
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
    var as = a.replace(/0*(\d+)/, function(ns) {
      return String.fromCharCode(1000+ns.length) + ns;
    });
    var bs = b.replace(/0*(\d+)/, function(ns) {
      return String.fromCharCode(1000+ns.length) + ns;
    });
    if (as > bs) return 1;
    if (as < bs) return -1;
    return 0;
  }
});

_.mixin({

  randomNormal: function() {
    var v1, v2, r, fac;
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


/*
  rsvp class
  Example, where we need 2 things from the database.

  var r0 = rsvp();

  // Allocate two futures, for robot and user
  // A future has a .done() function, which takes an optional value argument

  var robotInfoFuture = r0.future();
  var userInfoFuture = r0.future();

  db.getRobot('qb72', function(robotInfo) {
  robotInfoFuture.done(robotInfo);
  });
  db.getUser('tlb@tlb.org', function(userInfo) {
  userInfoFuture.done(userInfo);
  });

  // When all futures are complete, this function is fired. The .value holds the value passed into the .done function

  r0.end(function() {
  p('robotInfo=' + robotInfoFuture.value + ' userInfo=' + userInfoFuture.value);
  });

  Future has two optional arguments: (key, getValueFunc)

  If a string key is provided the future is added to a registry for this rsvp and a second call with the same key returns the same future.
  The second argument is called iff the future is being created. So a good pattern is:

  function futRobotInfo(r0, robotName) {
  return r0.future('robotInfo.' + robotName, function(f0) {
  db.getRobot(robotName, function(robotInfo) {
  f0.done(robotInfo);
  });
  });
  }

  This function returns a future value from the robot info database. If it's called multiple times
  for the same robotName & rsvp, it will only fetch the data once.

*/

function rsvp() {

  var rsvp0 = {
    outstanding: 1,
    endf: null,
    futureCache: {},
    future: function(key, getValueFunc) {
      var future0;
      if (key) future0 = rsvp0.futureCache[key];
      if (!future0) {
        rsvp0.outstanding ++;
        future0 = {
          value: undefined,
          pending: true,
          done: function(v) {
            if (!future0.pending) throw 'done rsvp.future().done called twice';
            future0.pending = false;
            future0.value = v;
            var qwv = future0.queuedWithValues;
            future0.queuedWithValues = [];
            for (var i=0; i<qwv.length; i++) {
              qwv[i](future0.value);
            }
            rsvp0.decr();
          },
          queuedWithValues: [],
          withValue: function(f) {
            if (future0.pending) {
              future0.queuedWithValues.push(f);
            } else {
              f(future0.value);
            }
          }
        };
        if (key) rsvp0.futureCache[key] = future0;
        if (getValueFunc) {
          getValueFunc(future0);
        }
      }
      return future0;
    },
    end: function(f) {
      if (rsvp0.endf) throw 'rsvp.end called twice';
      rsvp0.endf = f;
      rsvp0.decr();
    },
    incr: function() {
      rsvp0.outstanding ++;
    },
    decr: function() {
      rsvp0.outstanding -= 1;
      if (0 === rsvp0.outstanding) {
        setTimeout(rsvp0.checkZero, 0);
      }
    },
    checkZero: function() {
      if (0 === rsvp0.outstanding) {
        if (rsvp0.endf === null) throw 'rsvp.end not called';
        if (rsvp0.endf === 'done') throw 'rsvp.endf is done';
        rsvp0.endf();
        rsvp0.endf = 'done';
      }
    }
  };

  return rsvp0;
}

_.mixin({
  rsvp: rsvp
});


_.mixin({
  // Quote a string for literal matching inside a regexp
  requote: function(s) {
    return s.replace(/[\\\^\$\*\+\?\|\[\]\(\)\.\{\}]/g, "\\$&");
  }
});


// Polyfill for FF<4, IE<9
if (!Object.create) {
  Object.create = function (o) {
    if (arguments.length > 1) {
      throw new Error('Object.create implementation only accepts the first parameter.');
    }
    function F() {}
    F.prototype = o;
    return new F();
  };
}

_.mixin({
  subclass: function(subClassFunc, superClassFunc) {
    subClassFunc.prototype = Object.create(superClassFunc.prototype);
  }
});


_.mixin({
  /*
    Return one of the options if it matches v, otherwise if v anything else return the first option.
    Intended for extracting enum values from URLs
  */
  limitToSelection: function(options, v) {
    for (var i=0; i<options.length; i++) {
      if (options[i] === v) return options[i];
    }
    return options[0];
  }
});


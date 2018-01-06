'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;
const symbolic_node = require('./symbolic_node');
const SymbolicNode = symbolic_node.SymbolicNode;
const SymbolicRef =  symbolic_node.SymbolicRef;
const SymbolicConst = symbolic_node.SymbolicConst;
const SymbolicExpr = symbolic_node.SymbolicExpr;

/*
  Emitting code
*/


SymbolicContext.prototype.registerWrapper = function() {
  let c = this;

  if (c.langs.c) {
    c.typereg.addWrapFunction(c.getSignature(), '', c.name, '', 'void', c.collectArgs((argName, argType, dir) => {
      if (dir === 'out') {
        return {
          argName,
          typename: argType.typename,
          dir,
          passing: '&',
        };
      }
      else if (dir === 'in') {
        return {
          argName,
          typename: argType.typename,
          dir,
          passing: 'const &',
        };
      }
    }));
  }
};


SymbolicContext.prototype.getSignature = function(lang) {
  let c = this;
  if (lang === 'c') {
    return `
      void ${c.name}(
        ${
          c.collectArgs((argName, argType, dir, opt) => {
            if (dir === 'out') {
              return `${argType.typename} &${argName}`;
            }
            else if (dir === 'in') {
              return `${argType.typename} const &${argName}`;
            }
          }).join(',\n        ')
        })
    `;
  }
  else if (lang === 'js') {
    return `
      function ${c.name}(${
        c.collectArgs((argName, argType, dir, opt) => {
          if (dir === 'out') {
            return []; // XXX was argName;
          }
          else if (dir === 'in') {
            return argName;
          }
        }).join(', ')
      })
    `;
  }
};

SymbolicContext.prototype.emitDecl = function(lang, f) {
  let c = this;
  if (lang === 'c') {
    f(c.getSignature(lang) + ';');
  }
};


SymbolicContext.prototype.emitDefn = function(lang, f) {
  let c = this;
  if (lang === 'js') {
    f(`exports.${c.name} = ${c.name};`);
  }
  _.each(c.preDefn, (code) => { code(lang, f); });
  f(`${c.getSignature(lang)} {`);
  _.each(c.preCode, (code) => { code(lang, f); });
  let returns = [];
  if (lang === 'js') {
    c.collectArgs((argName, argType, dir, opt) => {
      if (dir === 'out') {
        f(`let ${argName} = ${argType.getValueExpr(lang, 0)};`);
        returns.push(argName);
      }
    });
  }
  c.emitCode(lang, f);
  _.each(c.postCode, (code) => { code(lang, f); });

  if (lang === 'js') {
    if (returns.length > 1) {
      f(`return [${returns.join(', ')}];`);
    }
    else if (returns.length === 1) {
      f(`return ${returns[0]};`);
    }
  }

  f(`}
  `);
};



SymbolicContext.prototype.emitCode = function(lang, f) {
  let c = this;
  let deps = c.getDeps();
  let availCses = {};
  _.each(deps.writes, ({dst, values, augmented, type}) => {

    if (augmented) {

      _.each(values, ({value, modulation}) => {
        value.emitCses(lang, deps, f, availCses);
        modulation.emitCses(lang, deps, f, availCses);
      });

      if (type.typename === 'double') {
        f(`${dst.getExpr(lang, availCses, 'wr')} = ${_.map(values, ({value, modulation}) => {
          return `(${value.getExpr(lang, availCses, 'rd')} * ${modulation.getExpr(lang, availCses, 'rd')})`;
        }).join(' + ')};`);
      }
      else if (dst.type.templateName === 'vector' && _.every(values, (value) => value.type === dst.type.templateArgTypes[0])) {
        if (lang === 'c') {
          f(`${dst.getExpr(lang, availCses, 'wr')}.resize(${values.length});`);
          _.each(values, ({value, modulation}, index) => {
            f(`${dst.getExpr(lang, availCses, 'wr')}[${index}] = ${value.getExpr(lang, availCses, 'rd')};`);
          });
        }
        else if (lang === 'js') {
          f(`${dst.getExpr(lang, availCses, 'wr')}.length = ${values.length};`);
          _.each(values, ({value, modulation}, index) => {
            f(`${dst.getExpr(lang, availCses, 'wr')}[${index}] = ${value.getExpr(lang, availCses, 'rd')};`);
          });
        }
        else {
          c.error(`Unhandled lang`);
        }
      }
    }
    else {
      let v = c.combineValues(values, type);
      v.emitCses(lang, deps, f, availCses);
      f(`${dst.getExpr(lang, {}, 'wr')} = ${v.getExpr(lang, availCses, 'rd')};`);
    }
  });
  _.each(c.normalizeNeeded, (dst) => {
    if (lang === 'c') {
      f(`${dst.getExpr(lang, availCses, 'wr')}.normalize();`);
    }
    else if (lang === 'js') {
      f(`throw new Error('WRITEME: normalize ${dst.type.typename}');`);
    }
    else {
      c.error(`Unhandled lang`);
    }
  });
};


SymbolicNode.prototype.emitCses = function(lang, deps, f, availCses) {
  // nothing
};

SymbolicExpr.prototype.emitCses = function(lang, deps, f, availCses) {
  let e = this;
  let c = e.c;

  if (!availCses[e.cseKey]) {
    _.each(e.args, (arg) => {
      arg.emitCses(lang, deps, f, availCses);
    });
    if (deps.rev[e.cseKey] && deps.rev[e.cseKey].length > 1 && !e.isAddress) {
      // Wrong for composite types, use TypeRegistry
      if (lang === 'c') {
        f(`${e.type.typename} ${e.cseKey} = ${e.getExpr(lang, availCses, 'rd')};`);
        if (e.printName) {
          f(`eprintf("${e.printName} ${e.cseKey} = %s\\n", asJson(${e.cseKey}).it.c_str());`);
        }
      }
      else if (lang === 'js') {
        f(`let ${e.cseKey} = ${e.getExpr(lang, availCses, 'rd')};`);
      }
      availCses[e.cseKey] = true;
    }
  }
};

SymbolicRef.prototype.getExpr = function(lang, availCses, rdwr) {
  if (lang === 'human') {
    return `${this.name}`;
  }
  else if (this.dir === 'update' && rdwr === 'rd') {
    return `${this.name}Prev`;
  }
  else if (this.dir === 'update' && rdwr === 'wr') {
    return `${this.name}Next`;
  }
  else if (this.dir === 'in' && rdwr === 'rd') {
    return this.name;
  }
  else if (this.dir === 'const' && rdwr === 'rd') {
    return this.name;
  }
  else if (this.dir === 'out' && rdwr === 'wr') {
    return this.name;
  }
  else {
    this.c.error(`${this.cseKey}.getExpr(${lang}, .. ${rdwr}) with dir=${this.dir}: unimplemented`);
  }
};

SymbolicConst.prototype.getExpr = function(lang, availCses, rdwr) {
  let e = this;
  let c = e.c;
  assert.equal(rdwr, 'rd');

  return e.type.getValueExpr(lang, e.value);
};

SymbolicExpr.prototype.getExpr = function(lang, availCses, rdwr) {
  let e = this;
  let c = e.c;

  if (availCses && availCses[e.cseKey] && rdwr === 'rd') {
    return e.cseKey;
  }
  let argExprs = _.map(e.args, (arg) => {
    return arg.getExpr(lang, availCses, rdwr);
  });
  if (lang === 'human') {
    let impl = e.opInfo.impl.js || e.opInfo.impl.c;
    if (impl) {
      return impl.apply(e, argExprs);
    }
    return `${e.op}(${argExprs.join(', ')})`;
  }
  let impl = e.opInfo.impl[lang];
  if (!impl) {
    c.error(`No ${lang} impl for ${e.op}(${_.map(e.args, (a) => a.type.jsTypename).join(', ')})`);
  }
  return impl.apply(e, argExprs);
};


// ----------------------------------------------------------------------

SymbolicNode.prototype.toString = function() {
  return this.getExpr('human', {}, 'rd');
  //return util.inspect(this, {depth: 2, breakLength: 1/0});
};

SymbolicNode.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}`;
};

SymbolicRef.prototype.inspect = function(depth, opts) {
  return `${this.name}`;
};

SymbolicExpr.prototype.inspect = function(depth, opts) {
  if (depth < 0) return `${this.cseKey}`;

  const newOpts = Object.assign({}, opts, {
    depth: opts.depth === null ? null : opts.depth - 1
  });

  return `${this.cseKey} = ${this.op}(${_.map(this.args, (a) => util.inspect(a, newOpts)).join(', ')})`;
};

SymbolicConst.prototype.inspect = function(depth, opts) {
  if (this.type.typename === 'double') {
    return `${this.value}`;
  }
  else {
    return `${this.type.jsTypename}(${this.value})`;
  }
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.getDebugInfo = function() {
  let e = this;
  let c = e.c;
  c.error(`Unknown expression type for getDebugInfo ${e}`);
};

SymbolicRef.prototype.getDebugInfo = function() {
  let e = this;
  return {__ref: e.name, type: e.type.typename};
};

SymbolicConst.prototype.getDebugInfo = function() {
  let e = this;
  return e.value;
};

SymbolicExpr.prototype.getDebugInfo = function() {
  let e = this;

  let argExprs = _.map(e.args, (arg) => {
    return arg.getDebugInfo();
  });
  if (e.opInfo.impl.debugInfo) {
    return e.opInfo.impl.debugInfo.apply(e, argExprs);
  }
  else if (e.opInfo.impl.imm) {
    return e.opInfo.impl.imm.apply(e, argExprs);
  }
  else {
    return null;
  }
};

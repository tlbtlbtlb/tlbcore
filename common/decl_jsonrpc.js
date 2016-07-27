var _                   = require('underscore');
var assert              = require('assert');

module.exports = function(typereg) {

  var jsonrpcreq = typereg.struct('jsonrpcreq',
    ['method', 'string'],
    ['params', 'jsonstr']);
  jsonrpcreq.omitTypeTag = true;

  var jsonrpcrep = typereg.struct('jsonrpcrep',
    ['error', 'jsonstr'],
    ['result', 'jsonstr'],
    ['log_msgs', 'vector<string>']);
  jsonrpcrep.omitTypeTag = true;

};

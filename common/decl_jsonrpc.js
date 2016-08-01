var _                   = require('underscore');
var assert              = require('assert');

module.exports = function(typereg) {

  var jsonrpcmsg = typereg.struct('jsonrpcmsg',
    ['method', 'string'],
    ['error', 'jsonstr'],
    ['id', 'jsonstr'],
    ['params', 'jsonstr'],
    ['result', 'jsonstr'],
    ['log_msgs', 'vector<string>']);
  jsonrpcmsg.omitTypeTag = true;
};

var _                   = require('underscore');
var util                = require('util');
var fs                  = require('fs');

var logio               = require('./logio');
var Image               = require('./Image');
var VjsDbs              = require('./VjsDbs');
var Auth                = require('./Auth');
var VjsSite             = require('./VjsSite');
var Safety              = require('./Safety');

var apis = exports.apis = {};
var fetchApis = exports.fetchApis = {};

var clientStateCache = {};


apis.userUpdate = function(cookieUser, args, apiCb) {
  var interest = args.interest || {};
  if (typeof(interest) !== 'object') throw 'Bad interest';
  
  var updates = { clientStateCookie: Auth.generateCookie() };
  var prevClientState = {};
  if (args.clientStateCookie) {
    for (var i=clientStateCache.length - 1; i >= 0; i--) {
      if (clientStateCache[i].clientStateCookie === args.clientStateCookie) {
        prevClientState = clientStateCache[i].clientState;
        clientStateCache[i].clientStateCookie = updates.clientStateCookie;
        break;
      }
    }
  }

  apiCb({result: 'ok', updates: updates});
};


apis.sendErrlog = function(cookieUser, args, apiCb) {
  logio.E(cookieUser.logKey, 'Errors in ' + args.ua);
  _.each(args.errors || [], function(err) {
    if (_.isObject(err)) {
      err = util.inspect(err);
    }
    util.puts(err.replace(/^/mg, '    '));
  });
  apiCb({result: 'ok'});
};


apis.getServerStatus = function(cookieUser, args, apiCb) {

  var r0 = _.rsvp();
  var siteHitsFut = r0.future();
  var contentStatsFut = r0.future();

  VjsSite.getSiteHits(siteHitsFut.done);
  VjsSite.getContentStats(contentStatsFut.done);
  r0.end(function() {
    apiCb({result: 'ok',
           siteHits: siteHitsFut.value,
           contentStats: contentStatsFut.value});
  });
};


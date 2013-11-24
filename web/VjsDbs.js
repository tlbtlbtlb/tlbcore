// -*- js-indent-level:2 -*-
"use strict";
var _ = require('underscore');
var redis                = require('redis');
var sha                  = require('sha');

var logio = require('./logio');
var Auth                 = require('./Auth');
var Storage              = require('./Storage');
var Topology             = require('./Topology');
var Safety               = require('./Safety');

/*
  High-level interface to the database
*/

// ======================================================================

function VjsDb() {
}

VjsDb.prototype.setupRedis = function() {
  var self = this;
  if (self.redis) return;
  self.redis = redis.createClient(6383, '127.0.0.1', null);
  self.redis.on('error', function(e) {
    logio.E('redis', e);
  });
};


// ----------------------------------------------------------------------

var db = new VjsDb();
exports.db = db;

//db.setupRedis();


var _                   = require('underscore');
var assert              = require('assert');
var arma                = require('arma');

describe('arma::mat', function() {
  it('should work', function() {
    var m = new arma.mat(4,4);
  });
  it('eye should work', function() {
    var m = new arma.mat.eye(4,4);
  });
});

describe('arma::vec', function() {
  it('should work', function() {
    var v = new arma.vec(4);
  });
});



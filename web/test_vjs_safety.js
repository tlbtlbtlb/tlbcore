'use strict';
/* eslint-env mocha */
const _ = require('lodash');
const url = require('url');
const vjs_safety = require('./vjs_safety');

describe('vjs_safety.isValidEmail', function() {
  function cgood(email) {
    if (!vjs_safety.isValidEmail(email)) throw new Error('should be valid, but isValidEmail=false: ' + email);
  }
  function cbad(email) {
    if (vjs_safety.isValidEmail(email)) throw new Error('should be invalid, but isValidEmail=true: ' + email);
  }
  it('should work', function() {

    cgood('tlb@tlb.org');
    cgood('t@semi-anonymous.com');
    cgood('foo@bar.com');
    cbad('foo@bar');
    cgood('cloud-test+special_characters@foo.com');
  });
});

describe('vjs_safety.isValidLogName', function() {
  function cgood(name) {
    if (!vjs_safety.isValidLogName(name)) throw new Error('should be valid, but isValidLogName=false: ' + name);
  }
  function cbad(name) {
    if (vjs_safety.isValidLogName(name)) throw new Error('should be invalid, but isValidLogName=true: ' + name);
  }
  it('should work', function() {
    cgood('run_147');
    cgood('run_2015-04-04_12-34-56');
    cbad('');
    cbad('../../etc/passwd');
  });
});

describe('vjs_safety.isValidToken', function() {
  function cgood(name) {
    if (!vjs_safety.isValidToken(name)) throw new Error('should be valid, but isValidToken=false: ' + name);
  }
  function cbad(name) {
    if (vjs_safety.isValidToken(name)) throw new Error('should be invalid, but isValidToken=true: ' + name);
  }
  it('should work', function() {
    cgood('run_147');
    cgood('123123123123123123123123213213123123');
    cbad('foo-bar');
    cbad('');
    cbad('../../etc/passwd');
  });
});


describe('vjs_safety.isValidPassword', function() {
  function cgood(password) {
    if (!vjs_safety.isValidPassword(password)) throw new Error('should be valid, but isValidPassword=false: ' + password);
  }
  function cbad(password) {
    if (vjs_safety.isValidPassword(password)) throw new Error('should be invalid, but isValidPassword=true: ' + password);
  }
  it('should work', function() {

    cgood('foobar');
    cgood('h^77j@429');
    cgood('ugly123');
    cbad('ho');
    cbad('hobart\u1234;');
  });
});

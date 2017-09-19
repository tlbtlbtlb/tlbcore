'use strict';
const _ = require('underscore');
const url = require('url');
const Safety = require('./Safety');

describe('Safety.isValidEmail', function() {
  function cgood(email) {
    if (!Safety.isValidEmail(email)) throw new Error('should be valid, but isValidEmail=false: ' + email);
  }
  function cbad(email) {
    if (Safety.isValidEmail(email)) throw new Error('should be invalid, but isValidEmail=true: ' + email);
  }
  it('should work', function() {

    cgood('tlb@tlb.org');
    cgood('t@semi-anonymous.com');
    cgood('foo@bar.com');
    cbad('foo@bar');
    cgood('cloud-test+special_characters@foo.com');
  });
});

describe('Safety.isValidLogName', function() {
  function cgood(name) {
    if (!Safety.isValidLogName(name)) throw new Error('should be valid, but isValidLogName=false: ' + name);
  }
  function cbad(name) {
    if (Safety.isValidLogName(name)) throw new Error('should be invalid, but isValidLogName=true: ' + name);
  }
  it('should work', function() {
    cgood('run_147');
    cgood('run_2015-04-04_12-34-56');
    cbad('');
    cbad('../../etc/passwd');
  });
});

describe('Safety.isValidToken', function() {
  function cgood(name) {
    if (!Safety.isValidToken(name)) throw new Error('should be valid, but isValidToken=false: ' + name);
  }
  function cbad(name) {
    if (Safety.isValidToken(name)) throw new Error('should be invalid, but isValidToken=true: ' + name);
  }
  it('should work', function() {
    cgood('run_147');
    cgood('123123123123123123123123213213123123');
    cbad('foo-bar');
    cbad('');
    cbad('../../etc/passwd');
  });
});


describe('Safety.isValidPassword', function() {
  function cgood(password) {
    if (!Safety.isValidPassword(password)) throw new Error('should be valid, but isValidPassword=false: ' + password);
  }
  function cbad(password) {
    if (Safety.isValidPassword(password)) throw new Error('should be invalid, but isValidPassword=true: ' + password);
  }
  it('should work', function() {

    cgood('foobar');
    cgood('h^77j@429');
    cgood('ugly123');
    cbad('ho');
    cbad('hobart\u1234;');
  });
});

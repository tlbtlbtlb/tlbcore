const github_api = require('./github_api');
const assert = require('assert');
const util = require('util');

// This token just gives access to my email address
const tlbtlbtlbApiKey = '6f6c07bf7f3b50317f04f5cdd5f876573dfd8fa2';

describe('GithubApi', function() {
  if (0) it('should work for tlbtlbtlb', function(cb) {
    this.timeout(5000);
    let api = new github_api.GithubApi(tlbtlbtlbApiKey);
    api.getUserInfo(function(err, userInfo) {
      if (err) {
        // Allow ENOTFOUND if we're not on the internet
        if (/ENOTFOUND/.exec(err.toString())) {
          return cb(null);
        }
        console.log(err);
        return cb(err);
      }
      if (0) console.log(userInfo);
      if (!(userInfo.login === 'tlbtlbtlb')) {
        return cb(new Error('Expected userInfo.login="tlbtlbtlb", got ' + util.inspect(userInfo)));
      }
      cb();
    });
  });

  if (0) it('should report errors', function(cb) {
    this.timeout(5000);
    let api = new github_api.GithubApi('foobar');
    api.getUserInfo(function(err, userInfo) {
      if (!err) {
        return cb(new Error('Expected error using fake Github credentials'));
      }
      if (/ENOTFOUND/.exec(err.toString())) {
        return cb(null);
      }
      if (!(/Bad credentials/.exec(err.toString()))) {
        return cb(new Error('Expected /Bad credentials/ in err, got ' + err.toString()));
      }
      cb();
    });
  });
});

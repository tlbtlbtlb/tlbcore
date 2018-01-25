'use strict';
const _ = require('lodash');
const child_process = require('child_process');
const async = require('async');
const logio = require('../common/logio');
const vjs_topology = require('./vjs_topology');
const vjs_storage = require('./vjs_storage');
const vjs_safety = require('./vjs_safety');

exports.mkImageVersions = mkImageVersions;

let verbose = 2;

let filesToSync = [];

/*
  Create a resized or otherwise tweaked version of an image.
  (fn) is input filename. (version) is 'orig' or something like '320x240'

  When complete, (sizeCb) is called with (err, newFilename, width, height). err is null if success
*/
function fillImageVersion(fn, version, options, sizeCb)
{
  let cmd;
  let fn2 = fn;

  if (version !== 'orig') {
    fn2 = fn.replace(/\.(\w+)$/, '_' + version + '.jpg');
    if (fn2 === fn) {
      fn2 = fn + '_' + version + '$1';
    }
    if (fn2 === fn) {
      sizeCb('fillImageVersion: failed to make unique fn=' + fn + ' fn2=' + fn2);
      return;
    }
  }

  /*
    Use ImageMagick to make a smaller version. See http://www.imagemagick.org/www/command-line-options.html

    Watch out for special characters in fn. In particular, ImageMagick interprets :, *, [ and ]. See http://www.imagemagick.org/www/command-line-processing.html

    WRITEME someday: I'd love to bind Cairographics in and do this with better alpha blending.
    It does work out well to have it in a separate process, though. What I really want is a JSON-driven cairographics render process that we can just
    pipe commands to.
  */

  if (version === 'orig') {
    cmd = ('identify -ping ' + fn);
  }
  else if (version.match(/^S\d+x\d+$/)) {
    cmd = ('mogrify -resize ' + version.substr(1) + ' -strip -colorspace rgb -write ' + fn2 + ' ' + fn +
           ' && identify ' + fn2);
  }
  else if (version.match(/^R\d+x\d+$/)) {
    cmd = ('mogrify -resize ' + version.substr(1) + ' -raise 2 -strip -colorspace rgb -write ' + fn2 + ' ' + fn +
           ' && identify ' + fn2);
  }
  else if (version.match(/^T\d+x\d+$/)) {
    cmd = ('mogrify -thumbnail ' + version.substr(1) + ' -strip -colorspace rgb -write ' + fn2 + ' ' + fn +
           ' && identify ' + fn2);
  }
  else if (version.match(/^onqb$/)) {
    cmd = ('convert -size 90x297 xc:white' +
           ' -draw "image over 0,0 0,0 \'website/images/qbIcon90x297.jpg\'" ' +
           ' -draw "image over 33,2 14,10 \'' + fn + '\'" ' +
           fn2 +
           ' && identify ' + fn2);
  }
  else if (version.match(/^onqbhead$/)) {

    let hsScale = Math.min(28.0/options.origWidth, 25.0/options.origHeight);
    let drawWidth = Math.round(options.origWidth * hsScale);
    let drawHeight = Math.round(options.origHeight * hsScale);
    let drawX = Math.round(45 - drawWidth/2);
    let drawY = Math.round(15 - drawHeight/2);

    cmd = 'convert -size 120x92 xc:white';
    cmd += ' -draw "image over '  + drawX + ',' + drawY + ' ' + drawWidth + ',' + drawHeight + ' \'' + fn + '\'"';
    cmd += ' -draw "image over 0,0 0,0 \'website/images/qbheadBlankscreenW120.png\'"';
    if (options.fullName && options.fullName.length <= 28) {
      cmd += ' -pointsize 1.5';
      let textX = 45 - options.fullName.length/2;
      cmd += ' -draw "text ' + textX + ',7 \'' + options.fullName.replace(/^[\w ]/g, ' ') + '\'"';
    } else {
      cmd += ' -draw "line 38,7 52,8"';
    }
    cmd += ' ' + fn2;
    cmd += ' && identify ' + fn2;
  }
  else {
    sizeCb('fillImageVersion: bad version=' + version);
    return;
  }

  logio.O('magick', cmd);

  child_process.exec(cmd, function(err, stdout, stderr) {
    if (err) {
      sizeCb('fillImageVersion err=' + err + ' cmd=' + cmd);
      return;
    }
    let m = stdout.match(/^\S+ \S+ (\d+)x(\d+)/m, stdout);
    if (m) {
      let realwidth = parseInt(m[1], 10);
      let realheight = parseInt(m[2], 10);
      logio.I('magick', fn2 + ' ' + realwidth.toString() + 'x' + realheight.toString());
      sizeCb(null, fn2, realwidth, realheight);
      return;
    }
    logio.E('magick', stdout);
    if (stderr && stderr.length) logio.E('magick', stderr);
    sizeCb('Failed to parse ImageMagick output');
  });

  filesToSync.push(fn);
  filesToSync.push(fn2);
}

let syncActiveCount = 0;
function syncPendingFiles() {
  if (filesToSync.length === 0 || syncActiveCount > 0) return;

  let todo = _.uniq(_.sortBy(filesToSync, _.identity), true);
  filesToSync = [];

  let dests = vjs_topology.getRoleServers((i) => i.roles.web && i.roles.ssh && i.reachable && !i.local);

  syncActiveCount ++;
  async.each(dests, function(destInfo, parCb) {

    // WRITEME: make files relative to home dir
    let cmd = 'rsync -Rr --ignore-existing ' + _.map(todo, vjs_safety.shellQuote).join(' ') + ' ' + destInfo.name + ':. </dev/null';
    logio.O('os', cmd);

    child_process.exec(cmd, function(err, stdout, stderr) {
      if (err) logio.E(destInfo.name, 'rsync exec error');
      if (stderr && stderr.length) logio.E(destInfo.name, stderr);
      parCb(null);
    });

  }, function(err) {
    syncActiveCount --;
  }, 4);
}

function syncOneDir() {
  let updir = vjs_storage.chooseUploadDir();
  filesToSync.push(updir);
  syncPendingFiles();
}

let syncInterval = null;
function startPeriodicSync() {
  if (!syncInterval) {
    syncInterval = setInterval(syncOneDir, 60000);  // sync one directory every minute
  }
}

/*
  Make several standard resized/tweaked version of an image.
  Calls doneCb when finished.

  Note that these are all done in parallel by ImageMagick.

  Example:
  image.mkImageVersions('/tmp/qbPerson.jpg', function(versions) {
  console.log(versions);
  });
  Prints:
  {
  S640x480: '<img src="/tmp/qbPerson_S320x240.jpg" width="160" height="240">'
  , S320x240: '<img src="/tmp/qbPerson_S320x240.jpg" width="160" height="240">'
  , R320x240: '<img src="/tmp/qbPerson_R320x240.jpg" width="160" height="240">'
  , S160x120: '<img src="/tmp/qbPerson_S160x120.jpg" width="80" height="120">'
  , S100x75: '<img src="/tmp/qbPerson_S100x75.jpg" width="50" height="75">'
  , T32x24: '<img src="/tmp/qbPerson_T32x24.jpg" width="16" height="24">'
  , orig: '<img src="/tmp/qbPerson.jpg" width="200" height="300">'
  }


  Feel free to add new sizes if you need them somewhere.
  It also returns an imageInfo, basically {origFn: "...", tagsByVersion: ...above structure... }.
  On return, none of the versions will be filled in but they'll appear as the processing completes
*/

function mkImageVersions(origFn, options, cb) {
  let ii = { origFn: origFn, tagsByVersion: {}};

  startPeriodicSync();

  fillImageVersion(origFn, 'orig', {}, function(err, origFn, origWidth, origHeight) {
    if (err) {
      console.log('mkImageVersions: ' + err);
      syncPendingFiles();
      cb({});
      return;
    }

    ii.tagsByVersion.orig = '<img src="' + origFn + '" width="' + origWidth.toString() + '" height="' + origHeight.toString() + '">';

    let versions = ['S640x480', 'S320x240', 'R320x240', 'S160x120', 'onqbhead', 'onqb'];
    async.each(versions, function(sizetag, cb1) {
      fillImageVersion(origFn, sizetag, {origWidth: origWidth, origHeight: origHeight, fullName: options.fullName}, function(err, newFn, newWidth, newHeight) {
        if (err) {
          console.log(origFn + '(' + sizetag + '): ' + err);
        } else {
          ii.tagsByVersion[sizetag] = '<img src="' + newFn + '" width="' + newWidth + '" height="' + newHeight + '">';
        }
        cb1(null);
      });
    }, function(err) {
      cb(ii);
      syncPendingFiles();
    });
  });


  return ii;
}

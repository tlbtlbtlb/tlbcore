'use strict';
const _ = require('lodash');
const {$} = require('./vjs_browser');

/* ----------------------------------------------------------------------
   Format error messages
*/
$.fn.fmtErrorMessage = function(err) {
  this.clearSpinner();
  this.clearSuccessMessage();

  let em = this.find('.errorMessage').last();
  if (!em.length) em = this.find('.errorBox');
  if (!em.length) {
    em = $('<span class="errorMessage">');
    let eml = this.find('.errorMessageLoc');
    if (eml.length) {
      eml.append(em);
    } else {
      this.append(em);
    }
  }

  if (_.isString(err)) {
    em.text(err);
  }
  else if (_.isError(err)) {
    em.text(err.message);
  }
  else if (!err) {
    em.html('');
  }
  else {
    em.html('Unknown error ' + err.result);
  }
  em.show();
  return em;
};

$.fn.clearErrorMessage = function() {
  this.find('.errorMessage').hide();
  this.find('.errorMessageLoc').empty().hide();
  this.find('.successMessage').hide();
  this.find('.successMessageLoc').empty().hide();
  return this;
};

$.fn.fmtSuccessMessage = function(msg, specials) {
  this.clearSpinner();
  this.clearErrorMessage();

  let sm = this.find('.successMessage');
  if (!sm.length) sm = this.find('.successBox');
  if (!sm) {
    sm = $('span class="successMessage">');
    this.append('<br/>').append(sm);
  }

  if (_.isString(msg)) {
    sm.html(msg);
  }
  else if (specials && specials.hasOwnProperty(msg.result)) {
    sm.html('Success! <span class="successMessageBlack">' + specials[msg.result] + '</span>');
  }
  else {
    sm.html('Success! ' + msg.result);
  }
  sm.show();
  return sm;
};

$.fn.clearSuccessMessage = function() {
  this.find('.successMessage').empty();
  return this;
};

let flashErrorMessageTimeout = null;

$.flashErrorMessage = function(msg) {
  console.log('Error', msg);
  let fem = $('#flashErrorMessage');
  if (fem.length === 0) {
    fem = $('<div id="flashErrorMessage">').appendTo(document.body);
  }
  let sw = $(window).width();
  let fw = fem.width();
  fem.css({left: Math.floor((sw-fw)/2 - 30).toString() + 'px'});
  let em = $('<div class="errorMessage">');
  fem.append(em).show();
  fem.fmtErrorMessage(msg);
  if (flashErrorMessageTimeout) {
    clearTimeout(flashErrorMessageTimeout);
  }
  flashErrorMessageTimeout = setTimeout(() => {
    fem.fadeOut(500, function() {
      $(this).empty();
    });
  }, 2000);
};

let flashSuccessMessageTimeout = null;

$.flashSuccessMessage = function(msg) {
  let fem = $('#flashSuccessMessage');
  if (fem.length === 0) {
    fem = $('<div id="flashSuccessMessage">').appendTo(document.body);
  }
  let sw = $(window).width();
  let fw = fem.width();
  fem.css({left: Math.floor((sw-fw)/2 - 30).toString() + 'px'});
  let em = $('<div class="successMessage">');
  fem.append(em).show();
  fem.fmtSuccessMessage(msg);
  if (flashSuccessMessageTimeout) {
    clearTimeout(flashSuccessMessageTimeout);
  }
  flashSuccessMessageTimeout = setTimeout(() => {
    fem.fadeOut(500, function() {
      $(this).empty();
    });
  }, 2000);
};

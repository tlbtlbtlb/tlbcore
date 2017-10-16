/* globals CodeMirror, replaceLocationHash, gotoCurrentState */
'use strict';
const _ = require('underscore');

$.startEditUrl = function() {

  $(window).on('keydown', function(ev) {
    let cm, eu, pageid;
    if (ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey && ev.which === 69) { // C-E

      eu = $('#popupEditUrl');
      if (eu.length) return undefined; // already doing it, let key event propagate
      eu = $('<div id="popupEditBlock"></div><div id="popupEditUrl"></div>').appendTo(document.body);

      let state = history.state;
      pageid = history.state.pageid;
      let options = history.state.o;
      let optionsStr = JSON.stringify(options, false, 2);

      cm = CodeMirror(eu[1], {
        value: optionsStr,
        mode: {name: 'javascript', json: true},
        keyMap: 'emacs',
        smartIndent: true,
        lineNumbers: false,
        autofocus: true,
        extraKeys: {
          'Ctrl-S': function() { saveOptions(); },
          'Esc': function() { closeEdit(); }
        },
      });
      if (0) {
        window.cm0 = cm;
        console.log('CodeMirror stored in window.cm0 for your convenience');
      }
      return false;
    }

    function saveOptions() {
      let optionsStr2 = cm.getValue();
      let options2 = {};
      try {
        options2 = JSON.parse(optionsStr2);
      } catch(ex) {
        console.log(ex);
        return;
      }
      eu.remove();
      replaceLocationHash(pageid, options2);
      gotoCurrentState();
    }
    function closeEdit() {
      eu.remove();
    }
  });
};

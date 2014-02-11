

$.startEditUrl = function() {

  $(window).on('keydown', function(ev) {
    if (ev.ctrlKey && !ev.metaKey && !ev.altKey && !ev.shiftKey && ev.which === 69) { // C-E

      var eu = $('#popupEditUrl');
      if (eu.length) return undefined; // already doing it, let key event propagate

      eu = $('<div id="popupEditUrl">').appendTo(document.body);
      if (0) eu.on('keydown', function(ev) {
        console.log('ate', ev);
        return false;
      });

      var state = history.state;
      var pageid = history.state.pageid;
      var options = history.state.o;
      var optionsStr = JSON.stringify(options, false, 2);

      var cm = CodeMirror(eu[0], {
        value: optionsStr,
        mode:  {name: 'javascript', json: true},
        keyMap: 'emacs',
        smartIndent: true,
        lineNumbers: false,
        autofocus: true,
        extraKeys: {
          'Ctrl-S': function() { saveOptions(); }
        },
      });
      return false;

      function saveOptions() {
        var optionsStr2 = cm.getValue();
        var options2 = {};
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
    }
  });
}

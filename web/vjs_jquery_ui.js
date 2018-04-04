'use strict';
const fs = require('fs');
const insertStyle = require('insert-css');

let $ = window.$ = window.jQuery = require('jquery');
require('jquery-ui');
require('jquery-ui/ui/widgets/tabs');
require('jquery-ui/ui/unique-id');
require('jquery-ui/ui/safe-active-element');
require('jquery-ui/ui/keycode');
require('jquery-contextmenu');

insertStyle(fs.readFileSync(require.resolve('jquery-ui/themes/base/core.css'), 'utf8'));
insertStyle(fs.readFileSync(require.resolve('jquery-ui/themes/base/menu.css'), 'utf8'));
insertStyle(fs.readFileSync(require.resolve('jquery-ui/themes/base/tabs.css'), 'utf8'));
insertStyle(fs.readFileSync(require.resolve('jquery-ui/themes/base/theme.css'), 'utf8'));
insertStyle(fs.readFileSync(require.resolve('jquery-ui/themes/base/autocomplete.css'), 'utf8'));
insertStyle(fs.readFileSync(require.resolve('jquery-contextmenu/dist/jquery.contextMenu.css'), 'utf8'));

# tlbcore

Some common infrastructure shared among my projects. Written in C++ and Javascript / Node.js.

  * web: a Node.JS + browser web application framework
  * common: C++ and JS utilities. Includes a JSON I/O system
  * numerical : numerical stuff, built on top of Armadillo


Installing
--
```sh
npm i tlbcore
```

Web framework
--

The web application framework makes it easy to serve multiple projects from Node.js.
Start it like so:

```sh
node tlbcore/web/server.js dir...
```

It needs a modern browser, and I've only done cursory tests with IE.

In each dir, there should be a file `load.js` which defines both the server-side and client-side resources for a project. Here's an example for the tlb.org website:

```javascript
var path = require('path');
exports.load = load;

function load(webServer) {
  var p = webServer.baseProvider.copy();

  p.addCss(require.resolve('./tlb.css'));
  p.addScript(require.resolve('./Tlb.js'));
  p.addScript(require.resolve('./BalancingVehicles.js'));
  p.addScript(require.resolve('./HackingProjects.js'));
  p.setTitle('Trevor Blackwell');

  webServer.setUrl('/tlb/', p);
  webServer.setPrefixHosts('/tlb/', ['www.tlb.org', 'tlb.org',
                                     'www.trevorb.com', 'trevorb.com']);
  webServer.setupStdContent('/tlb/');
  webServer.setUrl('/tlb/favicon.ico', require.resolve('./images/favicon.ico'));
  webServer.setUrl('/tlb/images/', path.dirname(require.resolve('./images')));
}
```

Fetching http://tlb.org/ will return a single minified HTML file including all the javascript files added with `p.addScript`, and all the CSS files added with `p.addCss`. It also includes a bunch of libraries already included in `webServer.baseProvider`.

The third-party libraries include [jQuery](http://www.jquery.com/), [underscore](http://underscorejs.org), [eventemitter](https://www.npmjs.org/package/eventemitter), and [mixpanel](http://www.mixpanel.com). (They should be installed using npm). Tlbcore/web adds a bunch more goodies:

 * A browser history and URL fragment manager, to make single page apps easy
 * A websocket API for browser and server
 * By default, web pages make a websocket connection to ws://host/console. You can send error message over this channel by calling `errlog(...)`
 * Over the /console connection, they also ask to be notified when a the document changes.
 * When you save a source file that is part of an active browser session (like Tlb.js referenced above), it will use the websocket connection to ask the browser to reload. It's very convenient during development.

To use the application framework, define each page of content like:

```javascript
$.defPage('doc', function(o) {
  this.html('<div class="tlbcoreDoc"></div>');
  this.children().first().fmtContent('README');
  return this;
});
```

(That's a real example from tlbcore/doc/doc.js, which you can see when you `make run` and navigate to http://localhost:8000/doc/#doc.

The function is called like a jQuery function, with `this` bound to `$(document.body)`. Usually it will create some overall page-level HTML, then call other functions to fill in each section.


Geometry and Numerical Libraries
--
 * geom/geom_math adds basic geometrical operations on Armadillo's vector & matrix types.
 * geom/solid_geometry can read STL files (a polyhedron defined by a bunch of triangles) and compute simple geometrical properties like center of mass
 * numerical/polyfit has 3 and 5 degree polynomials and routines for fitting to sampled data


Build Problems
--

If you get compile errors about missing definitions for `fill::zeros` and `all()`, you probably have
an old version of Armadillo. We need version 6.400. Download version 6.400 or later and build from source:
```sh
	cd armadillo && cmake . -DCMAKE_INSTALL_PREFIX=/usr && make && sudo make install
```

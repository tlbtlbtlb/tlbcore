tlbcore
=======

A bunch of C++ and Node.js stuff shared among my projects:

  * code_gen: a javascript library for generating C++ data structure code, including JSON IO
  * common: a grab-bag of C++ utilities like stringprintf, wrappers around pthreads, read/write STL into JSON, etc.
  * numerical : numerical stuff, including polynomial fitting and C++ and Node.js wrappings of LAPACK functions
  * genes: a simple genome library, not good for anything yet
  * nodeif: wrap C++ code for Node.js
  * realtime: obsolete
  * web: a Node.JS + browser web application framework


Installing
--

    make install.ubuntu   (or install.port on OSX)
    make install.npm
    make
    make test

Web framework
--

The web application framework makes it easy to serve multiple projects from Node.js.
Start it like so:

    node tlbcore/web/server.js dir...

It needs a modern browser, and I've only done cursory tests with IE.

In each dir, there should be a file load.js which defines both the server-side and client-side resources for a project. Here's an example for the tlb.org website:

```javascript
    var path                = require('path');
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
 
Fetching http://tlb.org/ will return a single minified HTML file including all the javascript files added with p.addScript, and all the CSS files added with p.addCss. It also includes a bunch of libraries already included in webServer.baseProvider. 

The third-party libraries include jQuery, underscore, eventemitter, and mixpanel. (They should be installed using npm). Tlbcore/web adds a bunch more goodies:

 * A browser history and URL fragment manager, to make single page apps easy
 * A websocket API for browser and server
 * By default, web pages make a connection to ws://host/console. You can send error message over this channel by calling errlog(...)
 * Over the /console connection, they also ask to be notified when a the document changes.
 * When you save a source file that is part of an active browser session (like Tlb.js referenced above), it will use the websocket connection to ask the browser to reload. It's very convenient during development.

To use the application framework, define each page of content like:
  
```javascript
    $.defPage('about', function(o) {
      this.html('<p class="urAbout">Umbrella Research</p>');
      return this;
    });
```

The function is called like a jQuery function, with *this* bound to $(document.body). Usually it will create some overall page-level HTML, then call other functions to fill in each section.


Geometry and Numerical Libraries
--
 * geom/geom_math has basic geometrical types Vec2/3/4, Mat22/33/44, and operations among them
 * geom/solid_geometry can read STL files (a polyhedron defined by a bunch of triangles) and compute simple geometrical properties like center of mass
 * numerical/polyfit has 3 and 5 degree polynomials and routines for fitting to sampled data
 * numerical/lapack_if adds a c++ wrapper around a few LAPACK routines


Gene Library
--
 * Defines a way of modifying constants in source code that will someday be used to evolve control loops




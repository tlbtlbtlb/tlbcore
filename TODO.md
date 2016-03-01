# TODO

### Common

  * Clean up MoreUnderscore:
    - Eliminate arrayMapPar & friends (use async npm instead)
    - Eliminate subclass
    - Eliminate rsvp

### Dv

  * Get rid of foreachDv and DvRef. Instead, do dvCount / dvExport / dvImport.
  * Make Dv include a variable-sized set of derivatives.
  * We should give dvImport an identity matrix to set up the derivative problem for gradients
  * Should I throw this whole experiment away?

### Numerical

### Arma

### Web

 * Go through and make sure I'm decoding URI components in just the right places.
 * Add test cases for malicious URLs.
 * Add sourcemaps?   http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/
 * Consider using some actual supported framework? Maybe it's too late.

### code_gen

 * Do initializer and Initializer do something different? Unify them somehow

### nodeif

* Clean up:
   - Is fastJson still useful? I think it's only used when sending large arrays to the browser via binary blobs in websocket. But do I do this?

### geom

 * Get rid of solid_geometry.cc. Do it all in JS.
   - Make sure THREE.STLLoader works in Node environment.
   - Re-implement mass properties & hole analysis in JS.

# TODO

### jsonio:
  - write rdJsonBulk
  - blobs should be named, rather than indexed. partno=>partid. Can just be random, or maybe if I wanted to share blobs they could be a hash
  -   `unordered_map<string, shared_ptr<u_char *> >`


### Common

  * Clean up MoreUnderscore:
    - Eliminate arrayMapPar & friends (use async npm instead)
    - Eliminate subclass
    - Eliminate rsvp


### Numerical

### Arma

### Web
 * Replace mostly with webpack & socketcluster.

### code_gen
 * Try again to use blobs when writing traces.

### nodeif

### geom

 * Get rid of solid_geometry.cc. Do it all in JS.
   - Make sure THREE.STLLoader works in Node environment.
   - Re-implement mass properties & hole analysis in JS.

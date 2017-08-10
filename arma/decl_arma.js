var _                   = require('underscore');
var assert              = require('assert');

module.exports = function(typereg) {
  /*
     These are not correct prototypes: for example, they neglect that the functions are all in the arma namespace.
     The real prototypes are most template functions.
     But they're good enough for gen_marshall to construct a wrapper to call them this way.
     It seems too complicated to extract these from the armadillo header files
  */
  // u_int must come first so that C declarations are found properly, since it's the return type of other comparisons
  _.each(['U64', 'double', 'S64', 'arma::cx_double'], function(et) {
    var rTypename, cTypename, mTypename, srTypename, scTypename;
    var rType, cType, mType, srType, scType;
    _.each([0,2,3,4], function(rowFixed) {
      _.each([0,2,3,4], function(colFixed) {
        if (rowFixed && colFixed && rowFixed !== colFixed) return;

        rTypename = `arma::Row<${ et }>${ rowFixed ? `::fixed<${ rowFixed }>` : '' }`;
        cTypename = `arma::Col<${ et }>${ colFixed ? `::fixed<${ colFixed }>` : '' }`;
        mTypename = `arma::Mat<${ et }>${ (colFixed && rowFixed) ? `::fixed<${ rowFixed },${ colFixed }>` : '' }`;
        srTypename = `arma::subview_row<${ et }>`;
        scTypename = `arma::subview_col<${ et }>`;
        rType = typereg.template(rTypename);
        cType = typereg.template(cTypename);
        mType = typereg.template(mTypename);
        srType = typereg.template(srTypename);
        scType = typereg.template(scTypename);

        if (et === 'double') {
          if (rowFixed) {
            typereg.aliasType(rType, `arma::rowvec${ rowFixed.toString() }`);
          } else {
            typereg.aliasType(rType, 'arma::rowvec');
          }
          if (colFixed) {
            typereg.aliasType(cType, `arma::vec${ colFixed.toString() }`);
          } else {
            typereg.aliasType(cType, 'arma::vec');
          }
          if (colFixed && rowFixed) {
            typereg.aliasType(mType, `arma::mat${ rowFixed.toString() }${ colFixed.toString()}`);
          } else {
            typereg.aliasType(mType, 'arma::mat');
          }
        }
        else if (et === 'S64') {
          if (!rowFixed) {
            typereg.aliasType(rType, 'arma::irowvec');
          }
          if (!colFixed) {
            typereg.aliasType(cType, 'arma::ivec');
          }
          if (!colFixed && !rowFixed) {
            typereg.aliasType(mType, 'arma::imat');
          }
        }
        else if (et === 'cx_double') {
          if (!rowFixed) {
            typereg.aliasType(rType, 'arma::cx_rowvec');
          }
          if (!colFixed) {
            typereg.aliasType(cType, 'arma::cx_vec');
          }
          if (!colFixed && !rowFixed) {
            typereg.aliasType(mType, 'arma::cx_mat');
          }
        }

        srType.noSerialize = true;
        srType.isRef = true;
        scType.noSerialize = true;
        scType.isRef = true;

        // Mat type depends on Col and subview_row types when indexing
        mType.addDeclDependency(rType);
        mType.addDeclDependency(cType);
        mType.addDeclDependency(srType);
        mType.addDeclDependency(scType);

        // For row-col conversion
        rType.addDeclDependency(cType);
        cType.addDeclDependency(rType);

        rType.addDeclDependency(srType);
        rType.addDeclDependency(scType);

        cType.addDeclDependency(srType);
        cType.addDeclDependency(scType);

        var isInteger = (et === 'S64' || et === 'U64');
        var isComplex = (et === 'arma::cx_double');
        if (!isInteger) {
          typereg.scanCFunctions(`${ mTypename } inv(${ mTypename } a);`);
        }

        if (!rowFixed && !colFixed) {
          typereg.scanCFunctions([
            `
              ${ et } accu(arma::Col<${ et }> a);
              ${ et } accu(arma::Mat<${ et }> a);
              ${ et } dot(arma::Col<${ et }> a, arma::Col<${ et }> b);
              ${ et } cdot(arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            isInteger ? '' : `
              ${ et } cond(arma::Mat<${ et }> a);
              ${ et } det(arma::Mat<${ et }> a);
              ${ et } norm_dot(arma::Col<${ et }> a, arma::Col<${ et }> b);
              ${ et } norm(arma::Col<${ et }> a, int p);
              ${ et } norm(arma::Mat<${ et }> a, int p);
              ${ et } trace(arma::Mat<${ et }> a);
            `,
            //'${ et } rank(arma::Mat<${ et }> a);',
            //'${ et } rank(arma::Mat<${ et }> a, double tol);',
            isComplex ? '' : `
              arma::Col<${ et }> abs(arma::Col<${ et }> a);
              // Why don't these work with complex?
              arma::Col<${ et }> linspace< arma::Col<${ et }> >(${ et } a, ${ et } b, int n);
              arma::Mat<${ et }> linspace< arma::Mat<${ et }> >(${ et } a, ${ et } b, int n);
            `,
            isInteger ? '' : `
              // Algebra
              bool solve(arma::Mat<${ et }> &x, arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<${ et }> solve(arma::Mat<${ et }> a, arma::Col<${ et }> b);
            `,
            // simple
            `
              ${ et } min(arma::Col<${ et }> a);
              ${ et } max(arma::Col<${ et }> a);
              arma::Col<${ et }> min(arma::Mat<${ et }> a, int dim);
              arma::Col<${ et }> max(arma::Mat<${ et }> a, int dim);
              ${ et } prod(arma::Col<${ et }> a);
              arma::Col<${ et }> prod(arma::Mat<${ et }> a, int dim);
              ${ et } sum(arma::Col<${ et }> a);
              arma::Col<${ et }> sum(arma::Mat<${ et }> a, int dim);
              ${ et } mean(arma::Col<${ et }> a);
              arma::Col<${ et }> mean(arma::Mat<${ et }> a, int dim);
              ${ et } median(arma::Col<${ et }> a);
              arma::Col<${ et }> median(arma::Mat<${ et }> a, int dim);
              ${ et } stddev(arma::Col<${ et }> a);
              ${ et } var(arma::Col<${ et }> a);
            `,
            isComplex ? '' : `
              arma::Col<${ et }> stddev(arma::Mat<${ et }> a, int dim);
            `,
            isComplex ? '' : `
              arma::Col<${ et }> var(arma::Mat<${ et }> a, int dim);
            `,
            `
              bool all(arma::Col<${ et }> a);
              bool any(arma::Col<${ et }> a);

              arma::Col<${ et }> conv(arma::Col<${ et }> a, arma::Col<${ et }> b);
              arma::Col<${ et }> cor(arma::Col<${ et }> a, arma::Col<${ et }> b);
              arma::Col<${ et }> cor(arma::Col<${ et }> a);
              arma::Mat<${ et }> arma::cov(arma::Col<${ et }> a, arma::Col<${ et }> b);
              arma::Mat<${ et }> arma::cov(arma::Col<${ et }> a);
              arma::Col<${ et }> cross(arma::Col<${ et }> a, arma::Col<${ et }> b);
              arma::Col<${ et }> cumsum(arma::Col<${ et }> a);
              arma::Mat<${ et }> diagmat(arma::Col<${ et }> a);

              arma::Mat<${ et }> sort(arma::Mat<${ et }> a, char const *dir, int dim);
              arma::Col<${ et }> sort(arma::Col<${ et }> a, char const *dir);
              arma::Row<${ et }> sort(arma::Row<${ et }> a, char const *dir);

              arma::Col<${ et }> ones< arma::Col<${ et }> >(int ne);
              arma::Mat<${ et }> ones< arma::Mat<${ et }> >(int nr, int nc);
              arma::Col<${ et }> zeros< arma::Col<${ et }> >(int ne);
              arma::Mat<${ et }> zeros< arma::Mat<${ et }> >(int nr, int nc);

              arma::Mat<${ et }> eye< arma::Mat<${ et }> >(int nr, int nc);

              arma::Col<${ et }> randu< arma::Col<${ et }> >(int ne);
              arma::Mat<${ et }> randu< arma::Mat<${ et }> >(int nr, int nc);
              arma::Col<${ et }> randn< arma::Col<${ et }> >(int ne);
              arma::Mat<${ et }> randn< arma::Mat<${ et }> >(int nr, int nc);

              arma::Mat<${ et }> operator * (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<${ et }> operator * (arma::Mat<${ et }> a, arma::Col<${ et }> b);
              arma::Mat<${ et }> operator * (arma::Mat<${ et }> a, ${ et } b);
              arma::Col<${ et }> operator * (arma::Col<${ et }> a, ${ et } b);
              arma::Mat<${ et }> operator * (${ et } a, arma::Mat<${ et }> b);
              arma::Col<${ et }> operator * (${ et } a, arma::Col<${ et }> b);
            `,
            // ${ et } operator * (${ et } a, ${ et } b);
            `,
              arma::Mat<${ et }> operator + (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<${ et }> operator + (arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            // ${ et } operator + (${ et } a, ${ et } b);
            `
              arma::Mat<${ et }> operator - (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<${ et }> operator - (arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            // ${ et } operator - (${ et } a, ${ et } b);

            // These fail on 64 bit installations with Arma 4.2, but work with with Arma 7.2.
            `
              arma::Mat<U64> operator == (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<U64> operator == (arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            isComplex ? '' : `
              arma::Mat<U64> operator >= (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<U64> operator >= (arma::Col<${ et }> a, arma::Col<${ et }> b);
              arma::Mat<U64> operator <= (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<U64> operator <= (arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            `
              arma::Mat<U64> operator != (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<U64> operator != (arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            isComplex ? '' : `
              arma::Mat<U64> operator < (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<U64> operator < (arma::Col<${ et }> a, arma::Col<${ et }> b);
              arma::Mat<U64> operator > (arma::Mat<${ et }> a, arma::Mat<${ et }> b);
              arma::Col<U64> operator > (arma::Col<${ et }> a, arma::Col<${ et }> b);
            `,
            // bool operator == (${ et } a, ${ et } b);
            `
              arma::Row<U64> any(arma::Mat<U64> a);
              U64 any(arma::Row<U64> a);
              U64 any(arma::Col<U64> a);

              arma::Row<U64> all(arma::Mat<U64> a);
              U64 all(arma::Row<U64> a);
              U64 all(arma::Col<U64> a);
            `
          ].join('\n'));
        }
        else if (rowFixed && colFixed) {
          typereg.scanCFunctions([
            `
              ${ cTypename } operator + (${ cTypename } a, ${ cTypename } b);
              ${ cTypename } operator - (${ cTypename } a, ${ cTypename } b);

              ${ rTypename } operator + (${ rTypename } a, ${ rTypename } b);
              ${ rTypename } operator - (${ rTypename } a, ${ rTypename } b);

              ${ mTypename } operator + (${ mTypename } a, ${ mTypename } b);
              ${ mTypename } operator - (${ mTypename } a, ${ mTypename } b);
            `,
            isInteger ? '' : `
              double norm(${ cTypename } a, int p);
              double norm(${ mTypename } a, int p);
            `
          ].join('\n'));
        }
      });
    });
  });

  typereg.getType('arma::Col<double>').jsTypename = 'vec';
  typereg.getType('arma::Col<double>::fixed<2>').jsTypename = 'vec2';
  typereg.getType('arma::Col<double>::fixed<3>').jsTypename = 'vec3';
  typereg.getType('arma::Col<double>::fixed<4>').jsTypename = 'vec4';

  typereg.getType('arma::Col<S64>').jsTypename = 'ivec';
  typereg.getType('arma::Col<S64>::fixed<2>').jsTypename = 'ivec2';
  typereg.getType('arma::Col<S64>::fixed<3>').jsTypename = 'ivec3';
  typereg.getType('arma::Col<S64>::fixed<4>').jsTypename = 'ivec4';


  typereg.getType('arma::Mat<double>').jsTypename = 'mat';
  typereg.getType('arma::Mat<double>::fixed<2,2>').jsTypename = 'mat22';
  typereg.getType('arma::Mat<double>::fixed<3,3>').jsTypename = 'mat33';
  typereg.getType('arma::Mat<double>::fixed<4,4>').jsTypename = 'mat44';

  typereg.getType('arma::Mat<S64>').jsTypename = 'imat';
  typereg.getType('arma::Mat<S64>::fixed<2,2>').jsTypename = 'imat22';
  typereg.getType('arma::Mat<S64>::fixed<3,3>').jsTypename = 'imat33';
  typereg.getType('arma::Mat<S64>::fixed<4,4>').jsTypename = 'imat44';

  typereg.getType('arma::Row<double>').jsTypename = 'rowvec';
  typereg.getType('arma::Row<S64>').jsTypename = 'irowvec';
  typereg.getType('arma::Col<arma::cx_double>').jsTypename = 'cx_vec';
  typereg.getType('arma::Row<arma::cx_double>').jsTypename = 'cx_rowvec';
  typereg.getType('arma::Mat<arma::cx_double>').jsTypename = 'cx_mat';

  typereg.struct('MinMax',
    ['min', 'double'],
    ['max', 'double']);
  typereg.getType('MinMax').omitTypeTag = true;

  typereg.struct('ndarray',
    ['partOfs', 'U64'],
    ['partBytes', 'U64'],
    ['dtype', 'string'],
    ['shape', 'vector<U64>'],
    ['range', 'MinMax']);
};

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

        rTypename = 'arma::Row<' + et + '>' + (rowFixed ? '::fixed<'+rowFixed+'>' : '');
        cTypename = 'arma::Col<' + et + '>' + (colFixed ? '::fixed<'+colFixed+'>' : '');
        mTypename = 'arma::Mat<' + et + '>' + ((colFixed && rowFixed) ? '::fixed<' + rowFixed + ',' + colFixed + '>' : '');
        srTypename = 'arma::subview_row<' + et + '>';
        scTypename = 'arma::subview_col<' + et + '>';
        rType = typereg.template(rTypename);
        cType = typereg.template(cTypename);
        mType = typereg.template(mTypename);
        srType = typereg.template(srTypename);
        scType = typereg.template(scTypename);

        if (et === 'double') {
          if (rowFixed) {
            typereg.aliasType(rType, 'arma::rowvec' + rowFixed.toString());
          } else {
            typereg.aliasType(rType, 'arma::rowvec');
          }
          if (colFixed) {
            typereg.aliasType(cType, 'arma::vec' + colFixed.toString());
          } else {
            typereg.aliasType(cType, 'arma::vec');
          }
          if (colFixed && rowFixed) {
            typereg.aliasType(mType, 'arma::mat' + rowFixed.toString() + colFixed.toString());
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
          typereg.scanCFunctions(mTypename + ' inv(' + mTypename + ' a);');
        }

        if (!rowFixed && !colFixed) {
          typereg.scanCFunctions([
            'ET accu(arma::Col<ET> a);',
            'ET accu(arma::Mat<ET> a);',
            'ET dot(arma::Col<ET> a, arma::Col<ET> b);',
            'ET cdot(arma::Col<ET> a, arma::Col<ET> b);',

            isInteger ? '' : 'ET cond(arma::Mat<ET> a);',
            isInteger ? '' : 'ET det(arma::Mat<ET> a);',
            isInteger ? '' : 'ET norm_dot(arma::Col<ET> a, arma::Col<ET> b);',
            isInteger ? '' : 'ET norm(arma::Col<ET> a, int p);',
            isInteger ? '' : 'ET norm(arma::Mat<ET> a, int p);',

            //'ET rank(arma::Mat<ET> a);',
            //'ET rank(arma::Mat<ET> a, double tol);',
            'ET trace(arma::Mat<ET> a);',

            isComplex ? '' : 'arma::Col<ET> abs(arma::Col<ET> a);',

            // Why don't these work with complex?
            isComplex ? '' : 'arma::Col<ET> linspace< arma::Col<ET> >(ET a, ET b, int n);',
            isComplex ? '' : 'arma::Mat<ET> linspace< arma::Mat<ET> >(ET a, ET b, int n);',

            // Algebra
            isInteger ? '' : 'bool solve(arma::Mat<ET> &x, arma::Mat<ET> a, arma::Mat<ET> b);',
            isInteger ? '' : 'arma::Col<ET> solve(arma::Mat<ET> a, arma::Col<ET> b);',

            // simple
            'ET min(arma::Col<ET> a);',
            'ET max(arma::Col<ET> a);',
            'arma::Col<ET> min(arma::Mat<ET> a, int dim);',
            'arma::Col<ET> max(arma::Mat<ET> a, int dim);',
            'ET prod(arma::Col<ET> a);',
            'arma::Col<ET> prod(arma::Mat<ET> a, int dim);',
            'ET sum(arma::Col<ET> a);',
            'arma::Col<ET> sum(arma::Mat<ET> a, int dim);',
            'ET mean(arma::Col<ET> a);',
            'arma::Col<ET> mean(arma::Mat<ET> a, int dim);',
            'ET median(arma::Col<ET> a);',
            'arma::Col<ET> median(arma::Mat<ET> a, int dim);',
            'ET stddev(arma::Col<ET> a);',
            isComplex ? '' : 'arma::Col<ET> stddev(arma::Mat<ET> a, int dim);',
            'ET var(arma::Col<ET> a);',
            isComplex ? '' : 'arma::Col<ET> var(arma::Mat<ET> a, int dim);',

            'bool all(arma::Col<ET> a);',
            'bool any(arma::Col<ET> a);',

            'arma::Col<ET> conv(arma::Col<ET> a, arma::Col<ET> b);',
            'arma::Col<ET> cor(arma::Col<ET> a, arma::Col<ET> b);',
            'arma::Col<ET> cor(arma::Col<ET> a);',
            'arma::Mat<ET> arma::cov(arma::Col<ET> a, arma::Col<ET> b);',
            'arma::Mat<ET> arma::cov(arma::Col<ET> a);',
            'arma::Col<ET> cross(arma::Col<ET> a, arma::Col<ET> b);',
            'arma::Col<ET> cumsum(arma::Col<ET> a);',
            'arma::Mat<ET> diagmat(arma::Col<ET> a);',

            'arma::Mat<ET> sort(arma::Mat<ET> a, char const *dir, int dim);',
            'arma::Col<ET> sort(arma::Col<ET> a, char const *dir);',
            'arma::Row<ET> sort(arma::Row<ET> a, char const *dir);',

            'arma::Col<ET> ones< arma::Col<ET> >(int ne);',
            'arma::Mat<ET> ones< arma::Mat<ET> >(int nr, int nc);',
            'arma::Col<ET> zeros< arma::Col<ET> >(int ne);',
            'arma::Mat<ET> zeros< arma::Mat<ET> >(int nr, int nc);',

            'arma::Mat<ET> eye< arma::Mat<ET> >(int nr, int nc);',

            'arma::Col<ET> randu< arma::Col<ET> >(int ne);',
            'arma::Mat<ET> randu< arma::Mat<ET> >(int nr, int nc);',
            'arma::Col<ET> randn< arma::Col<ET> >(int ne);',
            'arma::Mat<ET> randn< arma::Mat<ET> >(int nr, int nc);',

            'arma::Mat<ET> operator * (arma::Mat<ET> a, arma::Mat<ET> b);',
            'arma::Col<ET> operator * (arma::Mat<ET> a, arma::Col<ET> b);',
            'arma::Mat<ET> operator * (arma::Mat<ET> a, ET b);',
            'arma::Col<ET> operator * (arma::Col<ET> a, ET b);',
            'arma::Mat<ET> operator * (ET a, arma::Mat<ET> b);',
            'arma::Col<ET> operator * (ET a, arma::Col<ET> b);',
            //'ET operator * (ET a, ET b);',

            'arma::Mat<ET> operator + (arma::Mat<ET> a, arma::Mat<ET> b);',
            'arma::Col<ET> operator + (arma::Col<ET> a, arma::Col<ET> b);',
            //'ET operator + (ET a, ET b);',

            'arma::Mat<ET> operator - (arma::Mat<ET> a, arma::Mat<ET> b);',
            'arma::Col<ET> operator - (arma::Col<ET> a, arma::Col<ET> b);',
            //'ET operator - (ET a, ET b);',

            // These fail on 64 bit installations with Arma 4.2, but work with with Arma 7.2.
            'arma::Mat<U64> operator == (arma::Mat<ET> a, arma::Mat<ET> b);',
            'arma::Col<U64> operator == (arma::Col<ET> a, arma::Col<ET> b);',
            isComplex ? '' : 'arma::Mat<U64> operator >= (arma::Mat<ET> a, arma::Mat<ET> b);',
            isComplex ? '' : 'arma::Col<U64> operator >= (arma::Col<ET> a, arma::Col<ET> b);',
            isComplex ? '' : 'arma::Mat<U64> operator <= (arma::Mat<ET> a, arma::Mat<ET> b);',
            isComplex ? '' : 'arma::Col<U64> operator <= (arma::Col<ET> a, arma::Col<ET> b);',
            'arma::Mat<U64> operator != (arma::Mat<ET> a, arma::Mat<ET> b);',
            'arma::Col<U64> operator != (arma::Col<ET> a, arma::Col<ET> b);',
            isComplex ? '' : 'arma::Mat<U64> operator < (arma::Mat<ET> a, arma::Mat<ET> b);',
            isComplex ? '' : 'arma::Col<U64> operator < (arma::Col<ET> a, arma::Col<ET> b);',
            isComplex ? '' : 'arma::Mat<U64> operator > (arma::Mat<ET> a, arma::Mat<ET> b);',
            isComplex ? '' : 'arma::Col<U64> operator > (arma::Col<ET> a, arma::Col<ET> b);',
            //'bool operator == (ET a, ET b);',

            'arma::Row<U64> any(arma::Mat<U64> a);',
            'U64 any(arma::Row<U64> a);',
            'U64 any(arma::Col<U64> a);',

            'arma::Row<U64> all(arma::Mat<U64> a);',
            'U64 all(arma::Row<U64> a);',
            'U64 all(arma::Col<U64> a);',

          ].join('\n').replace(/ET/g, et));
        }
        else if (rowFixed && colFixed) {
          typereg.scanCFunctions([
            cTypename + ' operator + (' + cTypename + ' a, ' + cTypename + ' b);',
            cTypename + ' operator - (' + cTypename + ' a, ' + cTypename + ' b);',

            rTypename + ' operator + (' + rTypename + ' a, ' + rTypename + ' b);',
            rTypename + ' operator - (' + rTypename + ' a, ' + rTypename + ' b);',

            mTypename + ' operator + (' + mTypename + ' a, ' + mTypename + ' b);',
            mTypename + ' operator - (' + mTypename + ' a, ' + mTypename + ' b);',
            isInteger ? '' : 'double norm(' + cTypename + ' a, int p);',
            isInteger ? '' : 'double norm(' + mTypename + ' a, int p);',
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


  typereg.struct('ndarray',
    ['partno', 'U64'],
    ['dtype', 'string'],
    ['shape', 'vector<U64>']);
};

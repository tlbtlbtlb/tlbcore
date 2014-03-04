var _                   = require('underscore');

module.exports = function(typereg) {
  /* 
     These are not correct prototypes: for example, they neglect that the functions are all in the arma namespace.
     But they're good enough for gen_marshall to construct a wrapper to call them this way.
     It seems too complicated to extract these from the armadillo header files
  */
  _.each(['double', 'arma::cx_double', 'int'], function(et) {
    typereg.template('arma::Col<' + et + '>');
    typereg.template('arma::Mat<' + et + '>');

    typereg.template('arma::subview_row<' + et + '>');
    typereg.getType('arma::subview_row<' + et + '>').noSerialize = true;
    typereg.getType('arma::subview_row<' + et + '>').isRef = true;

    // Mat type depends on Col type when indexing
    typereg.getType('arma::Mat<' + et + '>').extraDeclDependencies.push(typereg.getType('arma::Col<' + et + '>'));
    typereg.getType('arma::Mat<' + et + '>').extraDeclDependencies.push(typereg.getType('arma::subview_row<' + et + '>'));

    var isInteger = (et === 'int');
    var isComplex = (et === 'arma::cx_double');
    typereg.scanCFunctions(['ET accu(arma::Col<ET> a);',
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
                            'arma::Mat<ET> cov(arma::Col<ET> a, arma::Col<ET> b);',
                            'arma::Mat<ET> cov(arma::Col<ET> a);',
                            'arma::Col<ET> cross(arma::Col<ET> a, arma::Col<ET> b);',
                            'arma::Col<ET> cumsum(arma::Col<ET> a);',
                            'arma::Mat<ET> diagmat(arma::Col<ET> a);',

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
                            'arma::Vec<ET> operator * (arma::Mat<ET> a, arma::Vec<ET> b);',
                            'arma::Mat<ET> operator * (arma::Mat<ET> a, ET b);',
                            'arma::Vec<ET> operator * (arma::Vec<ET> a, ET b);',
                            'arma::Mat<ET> operator * (ET a, arma::Mat<ET> b);',
                            'arma::Vec<ET> operator * (ET a, arma::Vec<ET> b);',
                            //'ET operator * (ET a, ET b);',

                            'arma::Mat<ET> operator + (arma::Mat<ET> a, arma::Mat<ET> b);',
                            'arma::Vec<ET> operator + (arma::Vec<ET> a, arma::Vec<ET> b);',
                            //'ET operator + (ET a, ET b);',

                            'arma::Mat<ET> operator - (arma::Mat<ET> a, arma::Mat<ET> b);',
                            'arma::Vec<ET> operator - (arma::Vec<ET> a, arma::Vec<ET> b);',
                            //'ET operator - (ET a, ET b);',

                           ].join('\n').replace(/ET/g,et));
  });


  typereg.getType('arma::Col<double>').jsTypename = 'vec';
  typereg.getType('arma::Mat<double>').jsTypename = 'mat';
  typereg.getType('arma::Col<int>').jsTypename = 'ivec';
  typereg.getType('arma::Mat<int>').jsTypename = 'imat';
  typereg.getType('arma::Col<arma::cx_double>').jsTypename = 'cx_vec';
  typereg.getType('arma::Mat<arma::cx_double>').jsTypename = 'cx_mat';
};

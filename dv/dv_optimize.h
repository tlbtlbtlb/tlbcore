// -*- C++ -*-
#pragma once
#include "./dv.h"

template<typename PARMS>
struct DvOptimizer {
  DvOptimizer(PARMS &_parms, Dv (*_loss)(PARMS const &parms))
    :parms(&_parms), loss(_loss)
  {
    extract_dvs(parm_dvs, parms);
    best_loss = loss(parms);
  }
  
  void step() {
    size_t num_dvs = parm_dvs.size();

    double loss0 = loss(parms).value;

    // calculate jacobian. Rows are for variables (just one, the loss), columns for dvs.
    arma::mat jac0(1, num_dvs);
    for (size_t i=0; i < num_dvs.size(); i++) {
      dvs[i]->deriv = 1.0;
      Dv loss0_dvi = loss(parms);
      assert(loss0 == loss0_dvi.value);
      dvs[i]->deriv = 0.0;
      jac0[0, i] = loss0_dvi.deriv;
      if (1) eprintf("jac[0, %lu] = %g\n", (u_long)i, loss0_dvi.deriv);
    }
    
    // 
    
    

  }

  /*
    Parms, ie theta.
   */
  PARMS parms;
  vector<Dv *> parm_dvs;

  /*
    Loss function, ie h
   */
  Dv (*loss)(PARMS const &parms);
  double best_loss;
};
  
  

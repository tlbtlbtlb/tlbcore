
template<typename T> T yogaCombineValuesMax(T const &defVal, double mod0, T const &val0)
{
  if (mod0 > 0.0) {
    return val0;
  } else {
    return defVal;
  }
}

template<typename T, typename... Args> T yogaCombineValuesMax(T const &defVal, double mod0, T const &val0, double mod1, T const &val1, Args... args)
{
  return yogaCombineValuesMax(defVal, max(mod0, mod1), (mod0 > mod1) ? val0 : val1, args...);
}


template<typename T> T yogaCombineValuesLinear(T const &defVal, double mod0, T const &val0)
{
  if (mod0 > 0.0) {
    return (1.0/mod0) * val0;
  } else {
    return defVal;
  }
}

template<typename T, typename... Args> T yogaCombineValuesLinear(T const &defVal, double mod0, T const &val0, double mod1, T const &val1, Args... args)
{
  return yogaCombineValuesLinear(defVal, mod0 + mod1, mod0 * val0 + mod1 * val1, args...);
}

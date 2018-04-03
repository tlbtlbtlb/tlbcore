

template<typename T>
struct CubicBezier {
  CubicBezier(T const &_p0, T const &_p1, T const &_p2, T const &_p3)
    :p0(_p1), p1(_p1), p2(_p2), p3(_p3)
  {
  }
  CubicBezier()
  {
  }
  T p0, p1, p2, p3;
};

template<typename T>
CubicBezier< T > operator *(double const &a, CubicBezier< T > const &b)
{
  return CubicBezier< T >(a*b.p0, a*b.p1, a*b.p2, a*b.p3);
}

template<typename T>
double linearMetric(CubicBezier< T > const &a, CubicBezier< T > const &b)
{
  return linearMetric(a.p0, b.p0) + linearMetric(a.p1, b.p1) + linearMetric(a.p2, b.p2) + linearMetric(a.p3, b.p3);
}

template<typename T>
CubicBezier< T > linearComb(double aCoeff, CubicBezier< T > const &a, double bCoeff, CubicBezier< T > const &b)
{
  return CubicBezier< T >(
    linearComb(aCoeff, a.p0, bCoeff, b.p0),
    linearComb(aCoeff, a.p1, bCoeff, b.p1),
    linearComb(aCoeff, a.p2, bCoeff, b.p2),
    linearComb(aCoeff, a.p3, bCoeff, b.p3));
}

template<typename T>
bool hasNaN(CubicBezier< T > const &a)
{
  return hasNaN(a.p0) || hasNaN(a.p1) || hasNaN(a.p2) || hasNaN(a.p3);
}


template<typename T>
T bezier(CubicBezier< T > const &a, double t)
{
  return (1.0-t)*(1.0-t)*(1.0-t) * a.p0 +
    3 * (1.0-t)*(1.0-t)*t * a.p1 +
    3 * (1.0-t)*t*t * a.p2 +
    t*t*t * a.p3;
}



/*
  CubicBezier< T >
*/
template<typename POINT>
void wrJsonSize(WrJsonContext &ctx, CubicBezier< POINT > const &it) {
  ctx.size += 100;
  wrJsonSize(ctx, it.p0);
  wrJsonSize(ctx, it.p1);
  wrJsonSize(ctx, it.p2);
  wrJsonSize(ctx, it.p3);
}
template<typename POINT>
void wrJson(WrJsonContext &ctx, CubicBezier< POINT > const &it) {
  ctx.emit("{\"__type\":\"CubicBezier\",\"p0\":");
  wrJson(ctx, it.p0);
  ctx.emit(",\"p1\":");
  wrJson(ctx, it.p1);
  ctx.emit(",\"p2\":");
  wrJson(ctx, it.p2);
  ctx.emit(",\"p3\":");
  wrJson(ctx, it.p3);
  *ctx.s++ = '}';
}
template<typename POINT>
bool rdJson(RdJsonContext &ctx, CubicBezier< POINT > &it) {
  bool typeOk = false;
  ctx.skipSpace();
  if (*ctx.s != '{') return ctx.fail(typeid(it), "expected {");
  ctx.s++;

  while (true) {
    ctx.skipSpace();
    if (*ctx.s == '}') {
      ctx.s++;
      break;
    }
    if (ctx.matchKey("p0")) {
      if (!rdJson(ctx, it.p0)) return ctx.fail(typeid(it), "rdJson(it.p0)");
      if (*ctx.s == ',') {
        ctx.s++;
        continue;
      }
      if (*ctx.s == '}') {
        ctx.s++;
        break;
      }
    }
    else if (ctx.matchKey("p1")) {
      if (!rdJson(ctx, it.p1)) return ctx.fail(typeid(it), "rdJson(it.p1)");
      if (*ctx.s == ',') {
        ctx.s++;
        continue;
      }
      if (*ctx.s == '}') {
        ctx.s++;
        break;
      }
    }
    else if (ctx.matchKey("p2")) {
      if (!rdJson(ctx, it.p2)) return ctx.fail(typeid(it), "rdJson(it.p2)");
      if (*ctx.s == ',') {
        ctx.s++;
        continue;
      }
      if (*ctx.s == '}') {
        ctx.s++;
        break;
      }
    }
    else if (ctx.matchKey("p3")) {
      if (!rdJson(ctx, it.p3)) return ctx.fail(typeid(it), "rdJson(it.p3)");
      if (*ctx.s == ',') {
        ctx.s++;
        continue;
      }
      if (*ctx.s == '}') {
        ctx.s++;
        break;
      }
    }
    else if (ctx.match("\"__type\" : \"CubicBezier\"")) {
      typeOk = true;
      if (*ctx.s == ',') {
        ctx.s++;
        continue;
      }
      if (*ctx.s == '}') {
        ctx.s++;
        break;
      }
    }
  }
  return typeOk;
}

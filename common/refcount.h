// -*- C++ -*-
#ifndef TLBCORE_REFCOUNT_H
#define TLBCORE_REFCOUNT_H
#include "./anythreads.h"

struct refcounted {
  refcounted();
  virtual ~refcounted();

  // disallow copying
private:
  refcounted(refcounted const &other);
  refcounted & operator = (refcounted const &other);
public:
  int refcnt;
};

template<typename T>
struct refcount_ptr {
  refcount_ptr()
  :it(NULL)
  {
  }
  refcount_ptr(T *_it)
    :it(_it)
  {
    if (it != NULL) anyatomic_incr(it->refcnt);
  }

  template<typename U>
  refcount_ptr(refcount_ptr<U> const &other)
    :it(other.it)
  {
    if (it != NULL) anyatomic_incr(it->refcnt);
  }
  
  refcount_ptr(refcount_ptr const & other)
    :it(other.it)
  {
    if (it != NULL) anyatomic_incr(it->refcnt);
  }

  ~refcount_ptr()
  {
    if (it != NULL) {
      if (anyatomic_decr(it->refcnt) == 0) {
        delete it;
      }
      it = NULL;
    }
  }

  template<typename U> 
  refcount_ptr & operator = (refcount_ptr<U> const &other)
  {
    refcount_ptr<T>(other).swap(*this);
    return *this;
  }
  
  refcount_ptr & operator = (refcount_ptr const &other)
  {
    /*
      Note how we do this:
        construct a new temporary pointer based on other
        swap it with ourselves
        destruct the temporary (with our old referent)
      So it should DTRT with refcounts
    */
    refcount_ptr<T>(other).swap(*this);
    return *this;
  }
  
  refcount_ptr & operator = (T * other)
  {
    refcount_ptr<T>(other).swap(*this);
    return *this;
  }

  refcount_ptr & operator = (T const &other)
  {
    refcount_ptr<T>(T::construct(other)).swap(*this);
    return *this;
  }

  T & operator * () const
  {
    return *it;
  }

  T * operator -> () const
  {
    return it;
  }

  operator bool () const
  {
    return it != NULL;
  }
  
  void swap(refcount_ptr &other)
  {
    T * tmp = it;
    it = other.it;
    other.it = tmp;
  }
  
  T *it;
};

/*

 */

template<typename T, typename U>
inline bool operator == (refcount_ptr<T> const &a, refcount_ptr<U> const &b)
{
    return a.it == b.it;
}

template<typename T, typename U>
inline bool operator != (refcount_ptr<T> const &a, refcount_ptr<U> const &b)
{
    return a.it != b.it;
}

template<typename T>
inline bool operator == (refcount_ptr<T> const &a, T * b)
{
    return a.it == b;
}

template<typename T>
inline bool operator != (refcount_ptr<T> const &a, T * b)
{
    return a.it != b;
}

template<typename T>
inline bool operator == (T * a, refcount_ptr<T> const &b)
{
    return a == b.it;
}

template<typename T>
inline bool operator != (T * a, refcount_ptr<T> const &b)
{
    return a != b.it;
}

template<typename T>
inline bool operator < (refcount_ptr<T> const &a, refcount_ptr<T> const &b)
{
    return std::less<T *> () (a.it, b.it);
}

template<typename E, typename T, typename Y>
std::basic_ostream<E, T> &operator <<  (std::basic_ostream<E, T> &os, refcount_ptr<Y> const &p)
{
  if (p != 0) {
    os << *p.it;
  } else {
    os << "(null)";
  }
  return os;
}

/*
  These support use as a wrapper type by boost::python 
 */
template<typename T>
inline T *get_pointer(refcount_ptr<T> &it) {
  return it.it; 
}
template<typename T>
inline T const *get_pointer(const refcount_ptr<T> &it) {
  return it.it; 
}

#endif

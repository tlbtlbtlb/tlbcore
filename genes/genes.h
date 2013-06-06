#ifndef _TLBCORE_GENES_GENES_H
#define _TLBCORE_GENES_GENES_H

struct GeneSet {
  GeneSet(const char *_filename);
  void load();
  void save();

  template<typename T>
  T &lookup(char const *name);

  string filename;
  bool valid;
  map<string, int> mapInt;
  map<string, double> mapDouble;
  map<string, doublevector> mapDoublevector;
  
};


template<> int &GeneSet::lookup<int>(const char *name);
template<> double &GeneSet::lookup<double>(const char *name);
template<> doublevector &GeneSet::lookup<doublevector>(const char *name);

#define DEFGENESET  static GeneSet geneSet0(__FILE__ ".genes");
#define GENE(T, NAME) geneSet0.lookup<T>(NAME);


#endif

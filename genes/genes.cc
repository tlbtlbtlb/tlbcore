#include "../common/std_headers.h"
#include "./genes.h"

static vector<GeneSet *> *all;

GeneSet::GeneSet(const char *_filename)
  :filename(_filename), valid(false)
{
  while (1) {
    string::iterator slashIt = find(filename.begin(), filename.end(), '/');
    if (slashIt == filename.end()) break;
    filename = string(slashIt+1, filename.end());
  }
  filename = string("genedata/") + filename;

  if (!all) all = new vector<GeneSet *>;
  all->push_back(this);
  load();
}

void GeneSet::load()
{
  FILE *f = fopen(filename.c_str(), "r");
  if (!f) {
    eprintf("%s: %s (continuing)\n", filename.c_str(), strerror(errno));
    return;
  }
  eprintf("Loading %s...\n", filename.c_str());
  while (1) {
    char *l = getln(f);
    if (!l || !*l) break;
    char *p = l;
    char *typetok = strsep(&p, " ");
    if (!*typetok) continue;
    char *nametok = strsep(&p, " ");
    if (!strcmp(typetok, "int")) {
      char *valtok = strsep(&p, " ");
      lookup<int>(nametok) = atoi(valtok);
    }
    else if (!strcmp(typetok, "double")) {
      char *valtok = strsep(&p, " ");
      lookup<double>(nametok) = atof(valtok);
    }
    else if (!strcmp(typetok, "vector<double>")) {
      vector<double> &val = lookup<vector<double> >(nametok);
      val.clear();
      while (1) {
        char *valtok = strsep(&p, " ");
        if (!valtok || !*valtok) break;
        val.push_back(atof(valtok));
      }
    }
    else {
      die("Unknown type %s named %s", typetok, nametok);
    }
    
    delete l;
  }
  fclose(f);
  valid = true;
}

void GeneSet::save()
{
  if (!valid) return;

  string tmpFilename = filename + stringprintf(".tmp%d", (int)getpid());
  FILE *f = fopen(tmpFilename.c_str(), "w");
  if (!f) {
    eprintf("%s: %s\n", tmpFilename.c_str(), strerror(errno));
    return;
  }

  for (map<string, int>::iterator it = mapInt.begin(); it != mapInt.end(); it++) {
    fprintf(f, "int %s %d\n", it->first.c_str(), (int)it->second);
  }
  for (map<string, double>::iterator it = mapDouble.begin(); it != mapDouble.end(); it++) {
    fprintf(f, "double %s %g\n", it->first.c_str(), (double)it->second);
  }
  for (map<string, vector<double> >::iterator it = mapVectorDouble.begin(); it != mapVectorDouble.end(); it++) {
    fprintf(f, "vector<double> %s", it->first.c_str());
    for (vector<double>::iterator it2 = it->second.begin(); it2 != it->second.end(); it2++) {
      fprintf(f, " %g", *it2);
    }
    fprintf(f, "\n");
  }
  
  fclose(f);
  if (rename(tmpFilename.c_str(), filename.c_str()) < 0) {
    eprintf("%s: %s\n", filename.c_str(), strerror(errno));
    return;
  }

  eprintf("Wrote %s\n", filename.c_str());
}


template<>
int &GeneSet::lookup<int>(const char *name)
{
  return mapInt[name];
}

template<>
double &GeneSet::lookup<double>(const char *name)
{
  return mapDouble[name];
}

template<>
vector<double> &GeneSet::lookup<vector<double> >(const char *name)
{
  return mapVectorDouble[name];
}



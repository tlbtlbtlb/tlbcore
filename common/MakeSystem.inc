
UNAME_SYSTEM := $(shell uname -s)
UNAME_HOST := $(shell uname -n | sed -e 's/\..*//')

print-% : ; @echo $*=$($*)

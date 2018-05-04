
UNAME_SYSTEM := $(shell uname -s)
UNAME_HOST := $(shell uname -n | sed -e 's/\..*//')
UNAME_MACHINE := $(shell uname -m)

PUSHDIST_EXCLUDES += \
	--exclude '.git' \
	--exclude '.dockerimage' \
	--exclude '*.o' \
	--exclude '*.o.d' \
	--exclude '*.pyc' \
    --exclude '*.dylib' \
    --exclude '*.so' \
	--exclude 'node_modules' \
	--exclude '*.jsonlog' \
	--exclude 'build.src' \
	--exclude 'nodeif/build' \
	--exclude '._*' \
    --exclude '.build' \
	--exclude '.DS_Store' \
	--exclude '.deps' \
	--exclude 'obj.target' \
	--exclude '.*.pods' \
    --exclude '__pycache__'


printvar.% : ## Print named variable, eg "make printvar.UNAME_SYSTEM"
	@echo "$*=$($*) (flavor=$(flavor $*) origin=$(origin $*))"

printenv :
	env

printvars : $(foreach x,$(.VARIABLES),printvar.$(x))

.PHONY: help
help: force ## Show make targets
	@perl -n -e 'if (/^([\.a-zA-Z0-9_%-]+)\s*:+.*?##( .*)$$/g) { print sprintf("\033[36m%-30s\033[0m%s\n", $$1, $$2); }' $(MAKEFILE_LIST)

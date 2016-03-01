
UNAME_SYSTEM := $(shell uname -s)
UNAME_HOST := $(shell uname -n | sed -e 's/\..*//')

printvar.% : ## Print named variable, eg "make printvar.UNAME_SYSTEM"
	@echo $*=$($*)


.PHONY: help
help: force ## Show make targets
	@perl -n -e 'if (/^([\.a-zA-Z0-9_%-]+)\s*:+.*?##( .*)$$/g) { print sprintf("\033[36m%-30s\033[0m%s\n", $$1, $$2); }' $(MAKEFILE_LIST)

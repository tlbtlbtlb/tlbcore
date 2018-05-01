
# Reasonable user targets
default : build
test ::
build :: stage1
stage1 :: setup
clean ::
setup ::
size ::
node_modules ::

include mk/makesystem.inc
include mk/makedocker.inc

ifeq ($(UNAME_SYSTEM),Darwin)
export NODE_PATH = /usr/local/lib/node_modules
endif

# MAINTAINME
JS_SRCDIRS := \
	common \
	code_gen \
	arma \
	numerical \
	geom \
	nodeif \
	web

# Manual machine setup
# See https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
# See https://github.com/nodesource/distributions
.PHONY: install.ubuntu install.npm install.brew
install.ubuntu ::
	curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
	sudo apt-get update
	sudo apt-get -y install git make python-software-properties python g++ make software-properties-common curl pwgen
	sudo apt-get -y install nodejs
	sudo apt-get -y install liblapack-dev pkg-config cmake libopenblas-dev liblapack-dev libarpack2-dev libarmadillo-dev

install.brew ::
	brew install rename zopfli ffmpeg trash node tree ack hub git

install.npm ::
	npm install -g lodash node-gyp jshint mocha uglify-js
	npm install -g hiredis redis marked websocket xmldom  eventemitter jquery jsmin2 async codemirror mori cookie scrypt

install.armadillo ::
	curl -L -O http://sourceforge.net/projects/arma/files/armadillo-7.200.2.tar.xz
	tar xf armadillo-7.200.2.tar.xz
	cd armadillo-7.200.2 && ./configure && make && sudo make install

clean ::
	rm -rf build.src

setup ::
	mkdir -p build.src

PUSHDIST_EXCLUDE_REGEXPS +=

test :: build
	env NODE_PATH=$(NODE_PATH):$(CURDIR)/nodeif/bin mocha --reporter list $(foreach dir,$(JS_SRCDIRS),$(wildcard $(dir)/test_*.js)) build.src/test_*.js


run:
	node web/server.js doc

.PHONY: force
force :

.gitfiles : force
	git ls-files -z >$@

push.%: .gitfiles
	rsync -a --inplace --from0 --relative --files-from .gitfiles . $*:tlbcore/.

pushdist.% : force
	rsync -a --inplace --relative $(DOCKER_EXCLUDES) $(patsubst %,--exclude %,$(PUSHDIST_EXCLUDE_REGEXPS)) --delete . $*:tlbcore/.

lint :: ## Lint js code
	jshint --reporter unix $(foreach dir,$(JS_SRCDIRS),$(dir)/*.js)

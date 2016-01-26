
# Reasonable user targets
default : build
test :: 
build :: stage1
stage1 :: setup
clean ::
setup ::
size ::
node_modules ::

include common/MakeSystem.inc

# MAINTAINME
JS_SRCDIRS := \
	common \
	code_gen \
	arma \
	numerical \
	geom \
	nodeif \
	web \
	dv

DECL_TYPES := \
	arma/decl_arma.js \
	geom/decl_geom.js \
	numerical/decl_numerical.js \
	dv/decl_dv.js \
	dv/decl_testproblem.js

# Manual machine setup
# See https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
# See https://github.com/nodesource/distributions
.PHONY: install.ubuntu install.npm install.brew
install.ubuntu ::
	curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
	sudo apt-get update
	sudo apt-get -y install git make python-software-properties python g++ make software-properties-common curl pwgen
	sudo apt-get -y install nodejs
	sudo apt-get -y install liblapack-dev pkg-config cmake libarmadillo-dev

install.brew ::
	brew install rename zopfli ffmpeg trash node tree ack hub git

install.npm ::
	sudo npm install -g underscore node-gyp jshint mocha uglify-js
	sudo npm install -g hiredis redis marked websocket xmldom  eventemitter jquery jsmin2 async codemirror mori cookie scrypt

clean ::
	rm -rf build.src

setup ::
	mkdir -p build.src

stage1 ::
	node code_gen/mk_marshall.js $(DECL_TYPES)

stage1 ::
	cd nodeif && node-gyp configure


clean ::
	cd nodeif && node-gyp clean
	rm -rf nodeif/bin

build :: build.nodeif
build.nodeif :: 
	cd nodeif && node-gyp build --jobs 8
	mkdir -p node_modules
	cp nodeif/build/Release/ur.node node_modules/ur.node

test :: build
	env NODE_PATH=$(NODE_PATH):$(CURDIR)/nodeif/bin mocha --reporter list $(foreach dir,$(JS_SRCDIRS),$(wildcard $(dir)/test_*.js)) build.src/test_*.js


size ::
	size nodeif/build/Release/*.o

logsize ::
	node hackstats/updateSizeGraph.js nodeif/build/Release/*.o

deploy:
	git commit -am 'deploy' || echo commit failed
	git push deploy master

run:
	node web/server.js doc

.PHONY: force
force :

.gitfiles : force
	git ls-files -z >$@

push.%: .gitfiles
	rsync -ai --inplace --from0 --relative --files-from .gitfiles . $*:tlbcore/.

cross.%: push.%
	ssh $* 'cd tlbcore && env NODE_PATH=/usr/lib/node_modules make'

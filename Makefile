
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
	genes \
	web

DECL_TYPES := \
	arma/decl_arma.js \
	geom/decl_geom.js \
	numerical/decl_numerical.js

# Manual machine setup
# See https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
install.ubuntu ::
	sudo apt-get update
	sudo apt-get -y install git make python-software-properties python g++ make software-properties-common
	sudo add-apt-repository -y ppa:chris-lea/node.js
	sudo apt-get update
	sudo apt-get -y install nodejs
	sudo apt-get -y install liblapack-dev pkg-config cmake libarmadillo-dev

install.port ::
	sudo port install git nodejs armadillo

install.npm ::
	sudo npm install -g underscore node-gyp jshint mocha uglify-js
	cd .. && sudo npm install mocha underscore marked websocket base64 xmldom  eventemitter jquery jsmin2 async codemirror

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
	ln -sf build/Release nodeif/bin


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

t_anythreads :
	$(CXX) $(CFLAGS) $(CXXFLAGS) -O2 -o $@ common/t_anythreads.cc common/anythreads.cc common/hacks.cc common/exceptions.cc

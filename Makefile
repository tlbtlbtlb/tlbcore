
# Reasonable user targets
default : build
test :: build
build :: stage1
stage1 :: setup
clean ::
setup ::
size ::
node_modules ::

# MAINTAINME
JS_SRCDIRS = realtime code_gen nodeif geom gyro13 genes web


# Manual machine setup
# See https://github.com/joyent/node/wiki/Installing-Node.js-via-package-manager
install.ubuntu ::
	sudo apt-get install git make python-software-properties python g++ make software-properties-common
	sudo add-apt-repository ppa:chris-lea/node.js
	sudo apt-get update
	sudo apt-get install nodejs

install.npm ::
	sudo npm install mocha underscore
install.npm ::
	sudo npm install -g node-gyp


clean ::
	rm -rf build.src

setup ::
	mkdir -p build.src

stage1 ::
	node code_gen/mk_marshall.js geom/decl_geom.js

stage1 ::
	cd nodeif && node-gyp configure


clean ::
	cd nodeif && node-gyp clean
	rm -rf nodeif/bin

build :: 
	cd nodeif && node-gyp build
	ln -sf build/Release nodeif/bin


test ::
	../node_modules/mocha/bin/mocha --reporter list $(foreach dir,$(JS_SRCDIRS),$(wildcard $(dir)/test_*.js))


size ::
	size nodeif/build/Release/*.o

logsize ::
	node hackstats/updateSizeGraph.js nodeif/build/Release/*.o



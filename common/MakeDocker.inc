
EXPERIMENT_NAME ?= $(notdir $(shell pwd))

DOCKER_NAME ?= docker.com/$(EXPERIMENT_NAME)
DOCKER_EXCLUDES += \
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

EXPERIMENT_DIRS_TARARGS = $(foreach x, $(foreach x,. $(EXPERIMENT_EXTRA),$(shell cd $(x); pwd)),-C $(dir $(x)) $(notdir $(x)))
EXPERIMENT_DIRS_ABS = $(foreach x, $(foreach x,. $(EXPERIMENT_EXTRA),$(shell cd $(x); pwd)), $x)
EXPERIMENT_DIRS_HOMEREL = $(subst $(shell cd $(HOME); pwd),.,$(EXPERIMENT_DIRS_ABS))

EXPERIMENT_DOCKERFILE ?= $(EXPERIMENT_NAME)/deploy/Dockerfile

DOCKER_IMAGE := $(DOCKER_NAME):latest

REMOTE_DEVBOX := $(patsubst tcp://%:2376,%,$(DOCKER_HOST))

REMOTE_DOCKERBUILD_PREFIX = /tmp/dockerbuild-

# Debug the above
show-docker-contents ::
	tar -c $(DOCKER_EXCLUDES) $(EXPERIMENT_DIRS_TARARGS) | tar -t -v - | sort -k 1.27r | less

# Push the docker image to quay.io
docker-push :: docker-build
	docker push $(DOCKER_IMAGE)

ifeq ($(REMOTE_DEVBOX),)
docker-build ::
	tar -c $(DOCKER_EXCLUDES) $(EXPERIMENT_DIRS_TARARGS) | docker build -f $(EXPERIMENT_DOCKERFILE) -t $(DOCKER_IMAGE)  -
remote-rsync ::
	mkdir -p $(REMOTE_DOCKERBUILD_PREFIX)$(EXPERIMENT_NAME)
	rsync -av --relative --delete-after $(DOCKER_EXCLUDES) $(RSYNC_DIRS) $(REMOTE_DOCKERBUILD_PREFIX)$(EXPERIMENT_NAME)/.
else
remote-rsync:
	ssh $(REMOTE_DEVBOX) mkdir -p $(REMOTE_DOCKERBUILD_PREFIX)$(EXPERIMENT_NAME)
	rsync -av --relative --delete-after $(DOCKER_EXCLUDES) $(RSYNC_DIRS) $(REMOTE_DEVBOX):$(REMOTE_DOCKERBUILD_PREFIX)$(EXPERIMENT_NAME)/.
docker-build :: remote-rsync
	ssh $(REMOTE_DEVBOX) "cd $(REMOTE_DOCKERBUILD_PREFIX)$(EXPERIMENT_NAME) && docker build -f $(EXPERIMENT_DOCKERFILE) -t $(DOCKER_IMAGE) ."
endif

docker-interactive ::
	docker run --rm -ti $(DOCKER_IMAGE) /bin/bash

show-kube-pods ::
	kubectl get pods -l app=dwqn

show-kube-nodes ::
	kubectl get nodes

start-docker-machine ::
	-docker-machine stop default
	docker-machine start default
	docker-machine env default

delete-kube-pods ::
	kubectl delete pods -l app=$(EXPERIMENT_NAME)

remote-docker-run ::
	ssh -t $(REMOTE_DEVBOX) "docker run -ti $(DOCKER_NAME):latest /bin/bash"

force :


# Performance notes
#  make docker-build (minor changes to last project, no compiling required, target in /tmp)
#      real	0m2.143s
#  make docker-build (no changes at all, target in /tmp)
#      real	0m1.720s
#  make docker-build (no changes at all, target in ~)

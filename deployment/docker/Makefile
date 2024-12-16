DOCKER_NAMESPACE := victorialogs-datasource
PKG_PREFIX := github.com/VictoriaMetrics/victorialogs-datasource

ROOT_IMAGE ?= alpine:3.20.0
CERTS_IMAGE := alpine:3.20.0
GO_BUILDER_IMAGE := golang:1.21.6-alpine
BUILDER_IMAGE := local/builder:2.0.0-$(shell echo $(GO_BUILDER_IMAGE) | tr :/ __)-1
BASE_IMAGE := local/base:1.1.3-$(shell echo $(ROOT_IMAGE) | tr :/ __)-$(shell echo $(CERTS_IMAGE) | tr :/ __)

DATEINFO_TAG ?= $(shell date -u +'%Y%m%d%H%M%S')
GO_BUILDINFO = -X 'github.com/grafana/grafana-plugin-sdk-go/build.buildInfoJSON={\"time\":${DATEINFO_TAG},\"id\":\"victorialogs-datasource\",\"version\":\"${BUILDINFO_TAG}\",\"branch\":\"${PKG_TAG}\"}'


package-base:
	(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -q '$(BASE_IMAGE)$$') \
		|| docker build \
			--build-arg root_image=$(ROOT_IMAGE) \
			--build-arg certs_image=$(CERTS_IMAGE) \
			--tag $(BASE_IMAGE) \
			deployment/docker/base

docker-scan: package-base
	docker scan --accept-license $(BASE_IMAGE) || (echo "❌ The build has been terminated because critical vulnerabilities were found in $(BASE_IMAGE)"; exit 1)

package-builder:
	(docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -q '$(BUILDER_IMAGE)$$') \
		|| docker build \
			--build-arg go_builder_image=$(GO_BUILDER_IMAGE) \
			--tag $(BUILDER_IMAGE) \
			deployment/docker/builder

app-via-docker: package-builder
	mkdir -p gocache-for-docker
	docker run --rm \
		-v "$(shell pwd):/usr/local/go/src/victorialogs-datasource" \
		-w /usr/local/go/src/victorialogs-datasource \
		-v "$(shell pwd)/gocache-for-docker:/gocache" \
		--user $(shell id -u):$(shell id -g) \
		--env GOCACHE=/gocache \
		--env GOOS=$(GOOS) \
		--env GOARCH=$(GOARCH) \
		$(DOCKER_OPTS) \
		$(BUILDER_IMAGE) \
		go build $(RACE) -trimpath -buildvcs=false \
			-ldflags "-extldflags '-static' $(GO_BUILDINFO)" \
			-tags 'netgo osusergo nethttpomithttp2 musl' \
			-o ./plugins/$(PLUGIN_ID)/$(APP_NAME)_$(GOOS)_$(GOARCH)$(if$ (findstring windows,$(GOOS)),.exe,) ./pkg/

frontend-package-base-image:
	docker build -t frontent-builder-image -f deployment/docker/web/Dockerfile ./deployment/docker/web

frontend-build: frontend-package-base-image
	mkdir -p .npm .cache && \
	chown -R $(shell id -u):$(shell id -g) .npm .cache && \
	docker run --rm \
		-v "$(shell pwd):/victorialogs-datasource" \
		-v "$(shell pwd)/.yarn:/.yarn" \
		-v "$(shell pwd)/.npm:/.npm" \
		-v "$(shell pwd)/.cache:/.cache" \
		-w /victorialogs-datasource \
		--user $(shell id -u):$(shell id -g) \
		--env YARN_CACHE_FOLDER="/victorialogs-datasource/.cache" \
		--entrypoint=/bin/bash \
		frontent-builder-image -c "yarn install --omit=dev && yarn build"

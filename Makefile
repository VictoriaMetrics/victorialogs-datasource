PKG_PREFIX := https://github.com/VictoriaMetrics/victorialogs-datasource

DATEINFO_TAG ?= $(shell date -u +'%Y%m%d%H%M%S')
BUILDINFO_TAG ?= $(shell echo $$(git describe --long --all | tr '/' '-')$$( \
	      git diff-index --quiet HEAD -- || echo '-dirty-'$$(git diff-index -u HEAD | openssl sha1 | cut -d' ' -f2 | cut -c 1-8)))

PKG_TAG ?= $(shell git tag -l --points-at HEAD)
ifeq ($(PKG_TAG),)
PKG_TAG := $(BUILDINFO_TAG)
endif

PLUGIN_ID=victoriametrics-logs-datasource
APP_NAME=victoriametrics_logs_backend_plugin

GO_BUILDINFO = -X 'github.com/grafana/grafana-plugin-sdk-go/build.buildInfoJSON={\"time\":${DATEINFO_TAG},\"id\":\"${PLUGIN_ID}\",\"version\":\"${BUILDINFO_TAG}\",\"branch\":\"${PKG_TAG}\"}'

.PHONY: $(MAKECMDGOALS)

frontend-package-base-image:
	docker build -t frontent-builder-image -f Dockerfile $(shell pwd)

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

app-via-docker-local:
	$(eval OS := $(shell docker run $(GO_BUILDER_IMAGE) go env GOOS))
	$(eval ARCH := $(shell docker run $(GO_BUILDER_IMAGE) go env GOARCH))
	$(MAKE) app-via-docker-$(OS)-$(ARCH)

vl-backend-plugin-build:
	which mage || go install github.com/magefile/mage@v1.15.0 && mage -v

vl-frontend-plugin-build: frontend-build

vl-plugin-build-local: vl-frontend-plugin-build app-via-docker-local

vl-plugin-build: vl-frontend-plugin-build vl-backend-plugin-build

vl-plugin-pack: vl-plugin-build
	mkdir -p dist && \
	$(eval PACKAGE_NAME := $(PLUGIN_ID)-$(PKG_TAG)) \
	cd plugins/ && \
	tar -czf ../dist/$(PACKAGE_NAME).tar.gz ./$(PLUGIN_ID) && \
	zip -q -r ../dist/$(PACKAGE_NAME).zip ./$(PLUGIN_ID) && \
	cd - && \
	sha256sum dist/$(PACKAGE_NAME).zip > dist/$(PACKAGE_NAME)_checksums_zip.txt && \
	sha256sum dist/$(PACKAGE_NAME).tar.gz > dist/$(PACKAGE_NAME)_checksums_tar.gz.txt

vl-plugin-cleanup:
	rm -rf ./victorialogs-datasource plugins

vl-plugin-release: \
	vl-plugin-pack \
	vl-plugin-cleanup

build-release:
	git checkout $(TAG) && $(MAKE) vl-plugin-release

golang-test:
	go test ./pkg/...

golang-test-race:
	go test -race ./pkg/...

golang-ci-lint: install-golang-ci-lint
	golangci-lint run ./pkg/...

install-golang-ci-lint:
	which golangci-lint || curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin v1.62.2

fmt:
	gofmt -l -w -s ./pkg

vet:
	go vet ./pkg/...

check-all: fmt vet golang-ci-lint

vl-plugin-check-install:
	which plugincheck2 || go install github.com/grafana/plugin-validator/pkg/cmd/plugincheck2@v0.20.3

vl-plugin-check: vl-plugin-release vl-plugin-check-install
	$(eval PACKAGE_NAME := $(PLUGIN_ID)-$(PKG_TAG)) \
	plugincheck2 -sourceCodeUri file://$(shell pwd)/ "$(shell pwd)/dist/${PACKAGE_NAME}.zip"

PKG_PREFIX := https://github.com/VictoriaMetrics/victorialogs-datasource

DATEINFO_TAG ?= $(shell date -u +'%Y%m%d%H%M%S')
BUILDINFO_TAG ?= $(shell echo $$(git describe --long --all | tr '/' '-')$$( \
	      git diff-index --quiet HEAD -- || echo '-dirty-'$$(git diff-index -u HEAD | openssl sha1 | cut -d' ' -f2 | cut -c 1-8)))

PKG_TAG ?= $(shell git tag -l --points-at HEAD)
ifeq ($(PKG_TAG),)
PKG_TAG := $(BUILDINFO_TAG)
endif

GO_BUILDINFO = -X 'github.com/grafana/grafana-plugin-sdk-go/build.buildInfoJSON={\"time\":${DATEINFO_TAG},\"id\":\"victorialogs-datasource\",\"version\":\"${BUILDINFO_TAG}\",\"branch\":\"${PKG_TAG}\"}'

.PHONY: $(MAKECMDGOALS)

include pkg/Makefile
include deployment/*/Makefile

app-local-goos-goarch:
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) go build $(RACE) -ldflags "$(GO_BUILDINFO)" -o victorialogs-datasource/$(APP_NAME)_$(GOOS)_$(GOARCH)$(RACE) pkg/

app-via-docker-goos-goarch:
	APP_SUFFIX='_$(GOOS)_$(GOARCH)' \
	DOCKER_OPTS='--env CGO_ENABLED=$(CGO_ENABLED) --env GOOS=$(GOOS) --env GOARCH=$(GOARCH)' \
	$(MAKE) app-via-docker

app-via-docker-windows-goarch:
	APP_SUFFIX='_$(GOOS)_$(GOARCH)' \
	DOCKER_OPTS='--env CGO_ENABLED=$(CGO_ENABLED) --env GOOS=$(GOOS) --env GOARCH=$(GOARCH)' \
	$(MAKE) app-via-docker-windows

app-via-docker-linux-amd64:
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 $(MAKE) app-via-docker-goos-goarch

app-via-docker-linux-arm:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm $(MAKE) app-via-docker-goos-goarch

app-via-docker-linux-386:
	CGO_ENABLED=0 GOOS=linux GOARCH=386 $(MAKE) app-via-docker-goos-goarch

app-via-docker-linux-arm64:
ifeq ($(APP_NAME),vmagent)
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 $(MAKE) app-via-docker-goos-goarch
else
	APP_SUFFIX='_linux_arm64' \
	DOCKER_OPTS='--env CGO_ENABLED=1 --env GOOS=linux --env GOARCH=arm64 --env CC=/opt/cross-builder/aarch64-linux-musl-cross/bin/aarch64-linux-musl-gcc' \
	$(MAKE) app-via-docker
endif

app-via-docker-darwin-amd64:
	CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 $(MAKE) app-via-docker-goos-goarch

app-via-docker-darwin-arm64:
	CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 $(MAKE) app-via-docker-goos-goarch

app-via-docker-windows-amd64:
	CGO_ENABLED=0 GOOS=windows GOARCH=amd64 $(MAKE) app-via-docker-windows-goarch

victorialogs-backend-plugin-build: \
	victorialogs-backend-plugin-amd64-prod \
	victorialogs-backend-plugin-linux-amd64-prod \
	victorialogs-backend-plugin-linux-arm-prod \
	victorialogs-backend-plugin-linux-arm64-prod \
	victorialogs-backend-plugin-linux-386-prod \
	victorialogs-backend-plugin-arm64-prod \
	victorialogs-backend-plugin-windows-prod

victorialogs-frontend-plugin-build: \
	frontend-build

victorialogs-datasource-plugin-build: \
	victorialogs-frontend-plugin-build \
	victorialogs-backend-plugin-build

victorialogs-datasource-plugin-pack-tar:
	tar -czf victorialogs-datasource-$(PKG_TAG).tar.gz ./plugins/victorialogs-datasource \
	&& sha256sum victorialogs-datasource-$(PKG_TAG).tar.gz \
	> victorialogs-datasource-$(PKG_TAG)_checksums_tar.txt

victorialogs-datasource-plugin-pack-zip:
	zip -r victorialogs-datasource-$(PKG_TAG).zip ./plugins/victorialogs-datasource \
	&& sha256sum victorialogs-datasource-$(PKG_TAG).zip \
	> victorialogs-datasource-$(PKG_TAG)_checksums_zip.txt

victorialogs-datasource-frontend-plugin-pack: \
	frontend-pack

victorialogs-datasource-frontend-plugin-release: \
	victorialogs-frontend-plugin-build \
	victorialogs-datasource-plugin-pack-tar \
	victorialogs-datasource-plugin-pack-zip

victorialogs-datasource-plugin-release: \
	victorialogs-frontend-plugin-build \
	victorialogs-backend-plugin-build \
	victorialogs-datasource-plugin-pack-tar \
	victorialogs-datasource-plugin-pack-zip \
	victorialogs-datasource-plugin-remove

victorialogs-datasource-plugin-remove:
	rm -rf ./plugins/victorialogs-datasource

build-release:
	git checkout $(TAG) && $(MAKE) victorialogs-datasource-plugin-release

frontend-build-release:
	git checkout $(TAG) && $(MAKE) victorialogs-datasource-frontend-plugin-release

golang-test:
	go test ./pkg/...

golang-test-race:
	go test -race ./pkg/...

golang-ci-lint: install-golang-ci-lint
	golangci-lint run ./pkg/...

install-golang-ci-lint:
	which golangci-lint || curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(shell go env GOPATH)/bin v1.51.2

fmt:
	gofmt -l -w -s ./pkg

vet:
	go vet ./pkg/...

check-all: fmt vet golang-ci-lint

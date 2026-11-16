FROM node:26.13.1-alpine3.24

RUN apk update && apk upgrade
RUN apk add --update python3 make g++ # for Mac M1 processors
RUN apk add zip --no-cache git bash bash-doc bash-completion libtool autoconf automake nasm pkgconfig libpng gcc make g++ zlib-dev gawk
# Yarn v1 Classic is no longer bundled in node images since Node.js 26; it only
# bootstraps the vendored Yarn release from .yarnrc.yml (yarnPath).
# See https://github.com/nodejs/docker-node#yarn-v1-classic-bundling
RUN npm install --global yarn

RUN mkdir -p /app
WORKDIR /app

#!/usr/bin/env sh
set -eu

docker build --tag astrograph-ci:local --file Dockerfile.ci .
docker run --rm astrograph-ci:local pnpm type-lint
docker run --rm astrograph-ci:local pnpm test
docker run --rm astrograph-ci:local pnpm test:package-bin

# Contributing

## Prerequisites

- Node.js 24 or newer
- pnpm 9.15.9 or compatible

## Setup

```sh
pnpm install
pnpm build
pnpm type-lint
pnpm test
```

## Package Smoke

Run the packed-package smoke before release-oriented changes:

```sh
pnpm test:package-bin
```

The package smoke creates a temporary consumer project and installs the packed
tarball, so it needs normal registry access for dependency resolution.

## Version Policy

Astrograph uses pre-1.0 alpha versions in the form
`major.minor.patch-alpha.increment`. Bump the alpha increment on each package
change and do not reset it across patch, minor, or major changes.

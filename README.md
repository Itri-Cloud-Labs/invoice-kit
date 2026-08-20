# Invoice Kit

Invoice Kit is a collection of libraries for generating Moroccan business documents. This repository keeps each language implementation in its own package so it can be versioned and released independently.

## Packages

| Language | Package | Status |
| --- | --- | --- |
| TypeScript | [`@ic-labs/invoice-kit`](./packages/typescript) | Available |
| Python | [`ic-labs-invoice-kit`](./packages/python) | Available |

Both packages support invoices, quotes, purchase orders, delivery notes, return notes, and price requests, including French and Arabic PDF output. They version and publish independently.

## Development

Install the TypeScript dependencies from the repository root:

```bash
npm run install:typescript
```

The root commands delegate to `packages/typescript`:

```bash
npm run typecheck:typescript
npm run build:typescript
npm run test:typescript
npm run smoke:typescript
npm run pack:typescript
```

See the [TypeScript package documentation](./packages/typescript/README.md) for its API and usage.

Install and verify the Python package with uv:

```bash
npm run install:python
npm run lint:python
npm run typecheck:python
npm run test:python
npm run smoke:python
npm run build:python
npm run pack:python
```

See the [Python package documentation](./packages/python/README.md) for its typed, snake-case API.

## Releasing TypeScript

TypeScript releases use npm for package installation and GitHub Releases for release notes and downloadable artifacts. Ordinary pushes to `main` never publish packages.

To publish a release:

1. Update `packages/typescript/package.json` and `packages/typescript/CHANGELOG.md` in a pull request.
2. Merge the pull request after CI passes.
3. Tag the merged commit as `typescript-v<version>` and push the tag.
4. Confirm the npm publication and matching GitHub Release.

The tag version must match the package version, and the changelog must contain a non-empty `## <version>` section. Stable versions publish under npm's `latest` tag. Prerelease versions publish under `next` and create a GitHub prerelease.

Publishing uses npm trusted publishing. The npm package must trust `.github/workflows/publish.yml` in this repository with the `npm` GitHub environment.

## Releasing Python

Python releases use PyPI and the shared GitHub release history. Ordinary pushes to `main` never publish packages.

1. Update `packages/python/pyproject.toml` and `packages/python/CHANGELOG.md` in a pull request.
2. Merge after CI passes.
3. Tag the merged commit as `python-v<version>` and push the tag.
4. Confirm the PyPI publication and matching GitHub Release.

PyPI trusted publishing must trust `.github/workflows/publish-python.yml` with the `pypi` GitHub environment.

## License

MIT

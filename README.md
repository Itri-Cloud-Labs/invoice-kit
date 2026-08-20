# Invoice Kit

Invoice Kit is a collection of libraries for generating Moroccan business documents. This repository keeps each language implementation in its own package so it can be versioned and released independently.

## Packages

| Language | Package | Status |
| --- | --- | --- |
| TypeScript | [`@ic-labs/invoice-kit`](./packages/typescript) | Available |
| Python | [`ic-labs-invoice-kit`](./packages/python) | Planned |

The TypeScript package supports invoices, quotes, purchase orders, delivery notes, return notes, and price requests. Its package name and public API remain unchanged after the monorepo move.

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

## License

MIT

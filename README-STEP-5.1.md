# DevOS Step 5.1 Bootstrap Package

This package establishes the implementation bootstrap foundation defined by the DevOS repository/code-structure specification.

## Included

- pnpm workspace monorepo configuration
- Turborepo task orchestration
- shared TypeScript configuration
- ESLint and Prettier configuration
- Vitest root configuration
- API, worker and web application shells
- all specified package boundaries
- cross-cutting test directories
- initial CI quality pipeline
- environment template

## Apply

Extract the contents into `C:\Development\devos`, preserving the existing `specs`, `docs`, `.ai`, and governance files.

Then run:

```powershell
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Do not mark Step 5.1 complete until these checks pass in the repository.

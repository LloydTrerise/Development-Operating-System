# DEVOS-003 — Shared Contracts

This package contains the shared TypeScript contract definitions required by the DevOS implementation foundation.

## Included

- Workflow version lifecycle statuses
- Workflow run lifecycle statuses
- Workflow task lifecycle statuses
- Artifact lifecycle statuses
- Work item creation request validation
- Workflow run start request validation

## Validation

Run from the repository root:

```powershell
pnpm --filter @devos/contracts typecheck
pnpm --filter @devos/contracts test
```

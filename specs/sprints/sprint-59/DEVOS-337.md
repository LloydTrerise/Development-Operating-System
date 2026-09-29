# DEVOS-337 — New initialisation-gate guard, error shape, and route resolution hook

**Priority:** P1
**Depends on:** Sprint 58 (DEVOS-333–336) — `getOrganisationInitialisationStatus`, `OrganisationInitialisationStatusDeps`. DEVOS-339's exemption field, by shape (this task's own tests use an in-memory fake of it — see the sprint README's "real dependency order" disclosure for why DEVOS-338 cannot wire this guard into live routes until DEVOS-339's real backfill has run, even though this task itself has no hard code dependency on DEVOS-339 existing first).
**Depended on by:** DEVOS-338 (attaches this guard to real routes); DEVOS-340 (validation).

## Scope

Define the guard function every gated route will call, the distinct error it throws when a request is rejected, and the `Route`-level hook (`resolveOrganisationId`) DEVOS-338 uses to tell the guard which organisation a given mutating request is scoped to. No route is wired to this guard yet — that is DEVOS-338's own scope.

## Implementation

`packages/domain/src/errors.ts` gains one new class, alongside `NotFoundError`/`ForbiddenError`/`ValidationError` (none of which carry a structured payload, confirmed by direct inspection — the sprint README's own grounding):

```ts
export class OrganisationNotInitialisedError extends ApplicationError {
  public readonly missingRequirements: readonly (
    'hasProjectType' | 'hasLlmProvider' | 'hasPolicy'
  )[];

  constructor(missingRequirements: readonly ('hasProjectType' | 'hasLlmProvider' | 'hasPolicy')[]) {
    super(
      `This organisation must complete setup before this action is available. Missing: ${missingRequirements.join(', ')}.`,
    );
    this.missingRequirements = missingRequirements;
  }
}
```

`packages/application/src/organisations/require-organisation-initialised.ts`:

```ts
export interface OrganisationEnforcementExemptionDeps {
  organisations: OrganisationRepository; // DEVOS-339 widens Organisation with the new exemption field this reads
}

export async function requireOrganisationInitialised(
  deps: OrganisationInitialisationStatusDeps & OrganisationEnforcementExemptionDeps,
  principalId: string,
  organisationId: OrganisationId,
): Promise<void> {
  const organisation = await deps.organisations.getById(organisationId);
  if (!organisation) throw new NotFoundError('Organisation');
  if (organisation.initialisationEnforcementExemptAt !== undefined) return; // DEVOS-339: grandfathered

  const status = await getOrganisationInitialisationStatus(deps, principalId, organisationId);
  if (status.initialised) return;

  const missing: ('hasProjectType' | 'hasLlmProvider' | 'hasPolicy')[] = [];
  if (!status.hasProjectType) missing.push('hasProjectType');
  if (!status.hasLlmProvider) missing.push('hasLlmProvider');
  if (!status.hasPolicy) missing.push('hasPolicy');
  throw new OrganisationNotInitialisedError(missing);
}
```

Reuses `getOrganisationInitialisationStatus` unchanged (including its own masked-`NotFoundError`-for-non-member behavior) rather than duplicating its membership/computation logic — the same "reuse, don't duplicate" discipline this epic has followed since Sprint 56.

`apps/api/src/http/router.ts`'s `Route` interface gains one new, optional field:

```ts
export interface Route {
  method: string;
  pattern: string;
  protected: boolean;
  handler: RouteHandler;
  /**
   * DEVOS-337/338: when present, a mutating request matching this route is
   * gated by `requireOrganisationInitialised` against the organisation id
   * this function resolves. `undefined` means "never gated" — either the
   * route is not organisation-scoped at all (health/me/platform-operators/
   * registration-tokens/project-types), or it is one of the three
   * setup-completing routes DEVOS-338 deliberately leaves unset (see that
   * task's own audit table). Only ever consulted for POST/PATCH/DELETE,
   * mirroring the existing `isMutatingMethod` check `apps/api/src/app.ts`
   * already applies to the DEVOS-091 rate limiter at the same chokepoint.
   */
  resolveOrganisationId?: (context: RouteContext) => Promise<OrganisationId | null>;
}
```

`apps/api/src/http/errors.ts` gains no new class of its own; instead `apps/api/src/app.ts`'s existing `toErrorBody` gains one new `instanceof` branch, mirroring its three existing `UseCase*Error` branches exactly:

```ts
if (error instanceof UseCaseOrganisationNotInitialisedError) {
  return {
    status: 403,
    body: {
      code: 'DEVOS_ORGANISATION_NOT_INITIALISED',
      message: error.message,
      details: { missingRequirements: error.missingRequirements },
    },
  };
}
```

`apps/api/src/app.ts`'s `handleRequest` gains the actual call site, placed immediately after the existing `isMutatingMethod`/rate-limiter block (the same chokepoint, same ordering rationale — reject before the handler runs, not after):

```ts
if (isMutatingMethod && match.route.resolveOrganisationId) {
  const organisationId = await match.route.resolveOrganisationId({
    principal,
    params: match.params,
    query: Object.fromEntries(url.searchParams),
    body,
    correlationId: requestId,
  });
  if (organisationId !== null && principal !== null) {
    await requireOrganisationInitialised(
      organisationInitialisationEnforcementDeps,
      principal.id,
      organisationId,
    );
  }
}
```

(Exact placement relative to the rate limiter, and whether `resolveOrganisationId` needs the already-parsed `body`/`params` or a narrower subset, is confirmed/adjusted at implementation time against the real `RouteContext` shape — the shape above is this task's own best-grounded draft, not a claim that the real router.ts diff will be byte-identical.)

## Out of scope

Attaching `resolveOrganisationId` to any real route (DEVOS-338). The exemption field's own migration/backfill (DEVOS-339) — this task only reads a field DEVOS-339 defines, via a shape both tasks agree on; DEVOS-337's own tests use an in-memory `OrganisationRepository` fake exposing that field, not a real migration. Any UI surfacing this error (Sprint 60).

## Acceptance

`pnpm --filter @devos/domain build` clean with `OrganisationNotInitialisedError` compiling. `pnpm --filter @devos/application typecheck lint test build` clean, with new tests proving: `requireOrganisationInitialised` resolves silently for an organisation with `initialised: true`; throws `OrganisationNotInitialisedError` listing exactly the missing requirements for an organisation with 0, 1, or 2 of the three present; resolves silently (bypassing live computation entirely) for an organisation whose exemption field is set, regardless of its real underlying status; masks a non-member/nonexistent organisation as `NotFoundError`, matching `getOrganisationInitialisationStatus`'s own established behavior. `apps/api` typecheck/lint/test/build clean, with a test proving `toErrorBody` maps the new error to `403 DEVOS_ORGANISATION_NOT_INITIALISED` with `details.missingRequirements` populated correctly, and that a route with no `resolveOrganisationId` is never gated regardless of method.

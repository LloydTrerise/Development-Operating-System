# DEVOS-341 — Guided registration-token redemption + organisation-creation UI

**Priority:** P1
**Depends on:** Sprint 57 (`createOrganisation` client function already accepts `{ name, slug, registrationToken }`, `apps/web/src/api-client.ts`; the server-side gate is unchanged and untouched by this task).
**Depended on by:** DEVOS-342 (the setup checklist is shown immediately after a successful creation from this flow); DEVOS-343 (the pilot's own record of what the guided flow looks like).

## Scope

Replace `OrganisationsPage.tsx`'s existing plain "New organisation" form (`name`/`slug`/`registrationToken` in one flat form, no explanation of the Admin side effect) with a guided, stepped flow that: asks for the registration token first; then asks for name/slug; explicitly discloses, in-product, before submission, that completing this makes the current principal that organisation's Admin. No change to `createOrganisation`'s call signature or the registration-token gate itself (Sprint 57) — this task is presentation only.

## Implementation

New component `apps/web/src/features/organisations/CreateOrganisationWizard.tsx`, replacing the inline form block at `OrganisationsPage.tsx:644-687`:

- An MUI `Stepper` with two steps:
  1. **"Registration token"** — a single required `TextField` (mirrors the placeholder form's own helper text: "Ask a platform operator to issue you a registration token."). `Next` is disabled until non-empty.
  2. **"Organisation details"** — `name`/`slug` fields, plus a persistent, visible (not a tooltip, not collapsed) disclosure line: *"Creating this organisation will make you (`<principal id>`) its Admin."* — reading the current principal id from `useSession()`, the same source `OrganisationsPage.tsx` already uses for `currentPrincipalId`. The submit button reads "Create organisation — you'll be its Admin", not a bare "Create organisation", so the disclosure is legible at the exact moment of commitment, not only above it.
- On submit, calls the existing `createOrganisation({ name, slug, registrationToken })` unchanged. On success: resets the wizard, calls the existing `refresh()`/`selectOrganisation(result.data.id)` (unchanged from the current handler), and additionally signals the newly-created organisation id upward via an `onCreated` prop so `OrganisationsPage` can auto-open DEVOS-342's setup checklist for it (see that task).
- On failure (invalid/expired/redeemed/revoked token, or a validation error): shows the existing `ErrorAlert` pattern, stays on step 2 (the token is not cleared, since the user may only need to fix name/slug — but if the error indicates a token problem, the user can `Back` to step 1 without re-entering name/slug).
- `Back`/`Next` navigation between the two steps; no skipping ahead without a non-empty token.

`OrganisationsPage.tsx` itself changes only to: replace its inline form JSX with `<CreateOrganisationWizard onCreated={...} />`, and remove the now-dead `name`/`slug`/`registrationToken`/`submitError`/`submitting`/`handleSubmit` state and handler (moved into the new component).

## Out of scope

Any change to registration-token issuance (`PlatformOperatorsPage.tsx`, unchanged), any change to `createOrganisation`'s server-side behavior, the setup checklist itself (DEVOS-342).

## Acceptance

`pnpm --filter @devos/web typecheck lint build` clean. Manual verification during implementation: the wizard genuinely blocks `Next` on an empty token; the disclosure sentence is visible on step 2 before submission, naming the real current principal id; a successful submission creates a real organisation via the unchanged `createOrganisation` call (confirmed against the real dev API) and selects it; a rejected token (e.g. empty/garbage string against the real gate) surfaces the real server error via `ErrorAlert` without crashing the flow.

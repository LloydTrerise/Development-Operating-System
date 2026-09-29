# DEVOS-348 — Setup checklist scroll-to-panel fix

**Priority:** P3 | **Estimate:** 0.25d
**Depends on:** none.
**Depended on by:** DEVOS-349.

## Scope

Close gap 5 (`specs/sprints/sprint-60/DEVOS-344.md`'s closing disclosure): `OrganisationSetupChecklist`'s "Configure an AI provider" action (`apps/web/src/features/organisations/OrganisationSetupChecklist.tsx:100-105`) calls `onOpenAiProviders`, which only sets `aiProvidersOpen` true (`OrganisationsPage.tsx:578`, inside `OrganisationRow`, `OrganisationsPage.tsx:462`) — correct behavior, but no scroll-into-view if that organisation's own row is off-screen in a long list.

## Implementation

- `OrganisationRow` (`apps/web/src/features/organisations/OrganisationsPage.tsx`) gained a `useRef<HTMLDivElement>(null)` (`rowRef`) attached to its own wrapping `Box` (the element containing the `ListItemButton` and all four `Collapse` panels).
- `onOpenAiProviders={() => setAiProvidersOpen(true)}` became `onOpenAiProviders={() => { setAiProvidersOpen(true); rowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }}`.
- No change to `OrganisationSetupChecklist.tsx` itself — the fix lives entirely in the row component that already owns both the ref target and the panel-open state.

## Out of scope

Any other checklist action ("Go to Projects"/"Go to Governance" already navigate to a different page, where off-screen-row is not a concern). Any change to `AiProvidersPanel` itself.

## Acceptance

Real dev-server verification, per `CLAUDE.md`'s UI-change requirement.

## Real end-to-end proof

Both `apps/api` (port 3000, real Postgres) and `apps/web` (Vite dev server, port 5173) were started for real. A temporary real organisation ("DEVOS-348 Scroll Verification Org", zero requirements met, `seed-user` as `ORGANISATION_ADMIN`) was inserted directly, exercised, then fully deleted afterward (org row + its one membership row — verified zero residue left).

A real Playwright script (headless Chromium) against the live app:

1. Installed a spy on `HTMLElement.prototype.scrollIntoView` before any app code ran, to distinguish this code's own explicit call from Playwright's own auto-scroll-before-click behavior on interactive elements.
2. Navigated to `/organisations`, clicked the new organisation's "Setup checklist" icon, then clicked its "Configure" action.
3. Confirmed the spy recorded exactly one call: `{"behavior":"smooth","block":"nearest"}` — this code's own call, not Playwright's.
4. A full-page screenshot after the click confirms the row is visible, its "Setup incomplete" chip and checklist are showing, and the AI Providers panel (Provider/Credential reference fields, "No LLM providers configured — this organisation uses the platform default.") is open directly below it.

`pnpm --filter @devos/web typecheck lint build` clean.

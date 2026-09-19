# DEVOS-147 — Cross-project compliance reporting

**Priority:** P1 | **Estimate:** 3d
**Depends on:** Sprint 15's DEVOS-141 (`AuditRecordRepository.listForOrganisation`, already real).
**Depended on by:** DEVOS-148 (the pilot's own compliance-export scenario).

## Scope

`GovernancePage.tsx` gains a real, organisation-scoped (not cross-organisation — tenant isolation, ADR-SEC-005) reporting view: search/filter by project, actor, action category and date range, plus a real CSV export of the matching `AuditRecord`s — the first real cross-project aggregate view in the product.

## Real design decision (resolving `specs/DEVOS-GOVERNANCE-AND-POLICY-AS-CODE-BACKLOG.md` §7's own flagged open question)

`AuditRecordRepository.listForOrganisation` already exists (DEVOS-141, a direct `organisation_id` query) — this task reuses it directly rather than looping every project's own `listForProject` client-side, closing the backlog's own named open question with the choice it already flagged as acceptable. A real authorization check (`resolveOrganisationMembership`, already existing and unmodified) gates the new route the same way DEVOS-139's own organisation-scoped policy routes already do.

## Implementation

- New application function `listAuditRecordsForOrganisation(deps, principalId, organisationId, options?)` (`packages/application/src/audit/`), mirroring `listAuditRecordsForProject`'s existing authorization shape but via `resolveOrganisationMembership`.
- New route `GET /organisations/:organisationId/audit` (`apps/api/src/routes/audit.ts` or similar).
- New `apps/web/src/api-client.ts` function `listAuditRecordsForOrganisation(organisationId)`.
- `GovernancePage.tsx` gains a new "Compliance report" section: fetches the organisation's own full audit list (a real, already-authorized, already-tenant-isolated query — no new client-side aggregation across organisations), with real client-side filters (project id/name, actor id, action-category prefix e.g. `tool_invocation.`/`policy.`/`approval.`, and a date range over `createdAt`) and a "Export CSV" action that serializes the currently-filtered rows into a real downloaded `.csv` file (a `Blob`/`URL.createObjectURL` download, the standard browser mechanism — no new server-side export endpoint needed, since the data is already real and already correctly scoped).

## Out of scope

Cross-*organisation* aggregation (explicitly excluded — ADR-SEC-005 tenant isolation). A saved-report/scheduled-export feature (not named in the backlog's own three-word scope).

## Acceptance

A real organisation's audit trail — spanning at least two of its real projects — is fetched through the new route and rendered in `GovernancePage.tsx`'s new report section; filtering by project/actor/action-category/date range narrows the rendered rows correctly (real client-side filter logic, proven with a unit test if the filter logic is extracted, or live-verified directly); the "Export CSV" action produces a real file whose rows match exactly what was filtered — confirmed against a real running `apps/api` and real Postgres with real records from two different projects in the same organisation. A non-member's request to the new route correctly 404s (tenant isolation, matching every other organisation-scoped route's own established convention).

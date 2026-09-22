# DEVOS-221 — Validation, documentation, and gap disclosure

**Priority:** P1 | **Estimate:** 0.5d
**Depends on:** DEVOS-218–220.
**Depended on by:** none — closes Sprint 32.

## Scope

Full monorepo validation, a real dev-server visual/click-through check, and explicit disclosure of every real gap this sprint surfaced or deliberately left open.

## Implementation

- Run `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'`; fix any real failure.
- Run the full real `tests/e2e` suite; confirm every existing file remains green (a regression check — this sprint touches `apps/web` restyle plus one additive DTO field in `apps/api`, no engine/domain change).
- Real dev-server visual check (Playwright against the real Vite dev server and a real running `apps/api`/Postgres): Approvals renders the split-pane layout with real approvals, filter tabs, and a working detail pane (including a real Approve/Reject and the `?approvalId=` deep link); Governance renders all four panels with real data, including a working policy publish/preview and compliance CSV export — in both light and dark mode, zero console errors. Confirm the Approvals page's own total scroll height no longer grows with the real seeded approval count (the Sprint 31 gap this restyle organically resolves).
- Record in this file's own Gaps section every deliberate omission: the mockup's "What will happen"/"Approval target"/"Why required"/"Traceability" boxes, "Defer", and the policy evaluation-count field.

## Out of scope

Any new feature beyond what DEVOS-218-220 already scoped.

## Acceptance

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` — record the actual pass count against Sprint 31's own 76/76 baseline. The full real `tests/e2e` suite green with no regression to Sprint 31's own last-reported file/test counts. Real dev-server visual and click-through confirmation, documented here per the epic's own Definition of Done (backlog §8).

## Actual results

Full validation green: `pnpm turbo run typecheck lint test build --filter='!@devos/e2e-tests'` **76/76 successful**, exactly matching Sprint 31's own baseline (this sprint adds no new package — one additive DTO field and one new test within existing packages). The full real `tests/e2e` suite **27/27 files, 52/52 tests green**, zero regression from Sprint 31's own last-reported count.

Real dev-server visual and click-through check (Playwright against the real Vite dev server and a real running `apps/api` connected to real Postgres, both light and dark mode, zero console errors throughout):
- **Approvals** (DEVOS-218): split-pane layout renders real data (477 approvals, 101 pending); filter tabs work; the detail pane shows real evidence and a working Approve/Reject action bar; the `?approvalId=` deep link selects the correct approval. **The page's own `document.body.scrollHeight` is confirmed 720px** in both light and dark mode, down from Sprint 31's disclosed 42,442px — the restyle genuinely, not just theoretically, resolves that gap.
- **Governance** (DEVOS-219): all four panels render real data; the audit trail table now shows `correlationId`; CSV export remains present and enabled; policy authoring/publish/preview UI is unchanged. Two empty states (0 policies, 0 reliability-evidence approvals for the currently-selected project) were independently confirmed genuine via a direct Postgres query, not a restyle regression.

## Gaps disclosed (not silently patched)

- **The mockup's "What will happen if you approve", "Approval target" grid, "Why approval is required" policy citation, and "Traceability" breadcrumb chain** (Approvals) are omitted — no real data source exists anywhere in this codebase for any of them (no per-approval consequence description, no per-approval policy-citation record, no lineage entity). Fabricating them would violate this project's own anti-fabrication discipline (AGENTS.md §7).
- **No "Defer" action** — only `approveApproval`/`rejectApproval` exist; a defer/snooze capability was never built.
- **`Policy`'s missing per-policy evaluation count** (the mockup's `p.enforced`) — no real evaluation-count tracking exists anywhere in this codebase.
- **A real, pre-existing limitation in the "Risk activity" panel, found (not introduced) during this sprint's own dev-server verification**: it can under-report real failures, since `listAuditRecordsForProject` (`packages/database/src/repositories/audit-records.ts:50`) has always capped its result at the 100 most-recent audit records — if none of those 100 happen to be a `FAILURE` outcome (confirmed for the real seeded project during this sprint's own check: 216 real historical failures exist, but none among its 100 most-recent records), the panel correctly, if incompletely, shows "No denied or failed activity recorded." The filter logic itself (`outcome === 'FAILURE'`) is completely unchanged from before this sprint — this is disclosed as a real, pre-existing limitation of the underlying route's own fixed page size, not a defect this restyle introduced or one this restyle's own scope covers fixing.
- **The Compliance report / Audit trail panel's own underlying data source (`listAuditRecordsForOrganisation`) was not changed** — this restyle only added the `correlationId` column to its existing rendering and CSV export; any pagination/limit behavior on that route is unchanged and out of this sprint's own scope.

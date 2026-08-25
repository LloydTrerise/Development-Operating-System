# DEVOS-083 — Secret management integration

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-082.

## Scope

"Replace local secret handling with managed references" (source, verbatim). DEVOS-053's `CredentialResolver` already stores credentials as env-var-by-reference-name (`configuration.credentialReference`), never as plaintext in the database — there is no local/plaintext secret storage to "replace." This task's real scope is auditing and hardening the existing reference mechanism's guarantees: a secret value must never be logged, never returned in an ordinary API response, and never placed in agent context — plus closing any gap found in that audit.

## Grounding

`specs/api/poc-api-contracts.md` §40 (Security-Sensitive Data Contract): "Credentials = reference-only", "Secrets = never in agent context". §41: "redact logs".

## Flagged gap

No new external secret-management provider (Vault, AWS Secrets Manager) is introduced — out of scope per the sprint README. The audit covers: integration DTOs/serializers (does any response path ever include the raw credential value?), structured logging call sites near credential resolution, and agent context construction (`packages/knowledge`/context manifest builders).

## Acceptance

A test asserts that resolving a credential and using it in a tool invocation produces no log line, audit record, or API response containing the underlying secret value — only the reference name. Any gap found by the audit is fixed.

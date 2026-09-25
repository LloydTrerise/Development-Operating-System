# LLM Credential Management — Backlog & Sprint Plan

**Document:** Candidate Epic (E30 — Organisation LLM Provider & Credential Gateway) Backlog & Sprint Plan
**Version:** 2.0 — revised after the user resolved all open decisions from v1.0 (§9 records each resolution and why). v1.0's grounding (§2) is unchanged; this version replaces the open-decisions section with a real epic map and product backlog.
**Status:** Decisions resolved — scope agreed. Still not authorized for implementation. Per `AGENTS.md` §35/§4.2, converting this into `specs/sprints/sprint-52/` (or any sprint below) and any implementation still requires the user's separate, explicit authorization to begin.
**Source:** A user conversation (2026-09-25) asking whether DevOS supports organisation-wide vs. per-user LLM credentials. It does not, in either direction — this document scopes the gap and, through the resolved decisions, the real shape of a fix.
**Predecessor:** None in the spec corpus. `specs/architecture/conceptual-architecture.md` §5.6 names an "AI Model Gateway" that is supposed to abstract provider/credential selection, but no such gateway has ever been built — this epic is that gateway, scoped down to what the user actually confirmed is wanted.
**Task-ID authority:** Continues the real, continuous numbering used by every prior sprint/backlog document (`DEVOS-001`–`DEVOS-310`), starting at `DEVOS-311`.

---

## 1. Purpose

Today, every AI-generated artifact DevOS produces — discovery reports, requirements, technical designs, implementation plans, development output, review decisions — is generated using **one single API key, for the whole application, set once at process startup**, for a single hardcoded provider (Gemini). There is no organisation-level key, no way to configure it at runtime, no UI surface for it, and no second provider to choose between.

This document scopes closing that gap: every organisation can configure its own ranked list of LLM providers/credentials, with the platform's existing single-key behavior preserved as the ultimate fallback for self-hosted/dev use.

---

## 2. Grounding — confirmed against the real, current implementation

Unchanged from v1.0. Per `AGENTS.md` §7/§8, this section states what is actually true today, verified by direct code inspection.

### 2.1 There is exactly one credential, for the whole process, resolved once at boot

`apps/worker/src/main.ts:240-246`: `resolveAgentModelAdapter()` reads `config.agents.geminiApiKey` (sourced from a single `GEMINI_API_KEY` environment variable, `packages/config/src/config.ts:102`) and constructs one `AgentModelAdapter` — a plain top-level `const modelAdapter = await resolveAgentModelAdapter();`. This is captured once into `agentTaskDeps` and reused for **every** `AGENT_TASK` the worker process ever handles, for every organisation, every project, every agent, for the process's lifetime. No per-request, per-project, or per-organisation resolution exists anywhere in this path today.

### 2.2 The model-invocation contract itself carries no scoping context

`packages/agents/src/model-adapter.ts:16-52` — `AgentInvocationRequest` contains only `configuration`, `promptReference`, `systemInstructions`, `objective`, `input`. No `projectId`, no `organisationId`, no principal reaches the adapter boundary. This interface must widen before a scoped credential/provider can be selected per call.

### 2.3 Only one provider is implemented; no gateway exists despite one being named in the architecture

`specs/architecture/conceptual-architecture.md` §5.6 names an "AI Model Gateway" responsible for "selecting a model," "managing provider-specific interfaces," and "enforcing model usage policies" — not built. What exists: one concrete adapter, `packages/agents/src/providers/gemini.ts` (`createGeminiModelAdapter`), plus a test-only fixture adapter. No provider registry, no routing logic, no second real provider.

### 2.4 The closest existing precedent is project-scoped and not wired to the model path at all

`packages/integrations/src/credential-resolver.ts` defines a real, working `CredentialResolver` (env-var-backed for local dev, real HashiCorp Vault-backed per DEVOS-106) resolving an `Integration.credentialReference` string to a secret value. `integrations` rows are scoped to `project_id` only (`specs/database/poc-database-schema.md` §13.1) — no organisation scope — and per this file's own code comment, `GEMINI_API_KEY`'s env-var precedent was never generalized onto this mechanism. Right *shape* of mechanism (reference-based secret resolution, pluggable env/Vault backends) to reuse; wrong scope and not wired to the model path.

### 2.5 Organisation is already a real, established cost/attribution scope — principal is not, for this purpose

`specs/DEVOS-COST-MANAGEMENT-BACKLOG.md` (Sprints 17–18, complete) already tracks/budgets AI usage at `Project.budgetUsd`/`AgentExecution.estimatedCostUsd` and `Organisation.budgetUsd` (DEVOS-155) — both real, both live. Organisation scope (§9.1 below) reuses this precedent directly.

Per-user scoping was considered and dropped (§9.1): E29's own settled Decision 7 (`specs/DEVOS-ACCESS-CONTROL-MODEL-BACKLOG.md` §9.7) established agents never authenticate and run autonomously with no per-call "triggering human" context — there is no natural anchor for a per-user credential today, and building one would mean inventing new plumbing this epic does not need.

---

## 3. What NOT to Build in This Epic

Resolved directly by §9's decisions — recorded here so the boundary is explicit, per the established convention of every prior epic backlog in this repo.

- **No project-level or per-user credential scope.** Organisation-only (§9.1). A project inherits whatever its organisation has configured; there is no project-level override.
- **No dynamic cost/quality/latency-based routing algorithm.** The org's provider list is a manually-ranked, admin-configured order (§9.5) — not an automatic optimizer. This deliberately leaves `DEVOS-AGENT-SELECTION-BACKLOG.md`'s own cost-aware selection work genuinely unbuilt; this epic only produces the real per-provider pricing data a future version of that work could eventually use.
- **No change to DevOS's agent-autonomy or authentication model.** Agents still never log in — E29 Decision 7 stays settled.
- **No new encrypted-secrets product.** `CredentialResolver`'s existing env/Vault mechanism is the foundation, widened in scope, not replaced (§9.4).
- **No change to budget alert behavior.** `estimatedCostUsd`/`budgetUsd` stay informational and alert-only regardless of whose credential was used (§9.6) — no automatic spend cutoff, matching `DEVOS-COST-MANAGEMENT-BACKLOG.md`'s own carried-forward principle.
- **No credential-testing/validation console.** Saving a reference confirms it resolves to *something* (per `CredentialResolver`'s existing contract); a full "call the real provider to validate this key" tool is a separate, unscoped addition.

---

## 4. Epic Map

Staged so every intermediate sprint leaves the system fully working and backward-compatible, per `AGENTS.md` §4.1.

| Sprint | Outcome | Depends on |
| --- | --- | --- |
| 52 — Organisation LLM Provider Foundation | `organisation_llm_providers` table + widened `CredentialResolver`; zero visible behavior change (adapter still resolved once at boot, exactly as today) | — |
| 53 — Provider Gateway & Per-Task Resolution | A real provider registry replacing the single hardcoded Gemini adapter; `AgentInvocationRequest`/`run-agent-task.ts` widened to carry `organisationId`; per-task (not boot-time) adapter resolution; per-provider pricing | 52 |
| 54 — Ranked Fallback & Access Control UI | The manually-ranked fallback chain (org providers, in priority order, falling through to the platform default); organisation-admin-only write gate; an "AI Providers" settings panel | 52, 53 |
| 55 — Full-Epic Pilot & Close-Out | Real end-to-end pilot proving the fallback chain, cost attribution, and audit trail all work against a real second provider; final validation and disclosure | 52, 53, 54 |

---

## 5. Product Backlog

### 5.1 Sprint 52 — Organisation LLM Provider Foundation (DEVOS-311–313)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-311 | `organisation_llm_providers` table, migration | New table: `organisation_id` (FK), `provider` (discriminator, e.g. `gemini`/`anthropic`/`openai`), `credential_reference`, `priority` (rank, unique per org), `status` (Active/Disabled), timestamps. No row required to exist — an org with none keeps today's platform-default behavior. Zero change to any existing route or task-execution behavior. |
| DEVOS-312 | `CredentialResolver` widened to a real organisation-scoped LLM credential namespace | The existing `resolve(reference): Promise<string \| null>` contract is reused unchanged; `credential_reference` values resolve through it (env-var locally, Vault path in the real backend), kept in a namespace distinct from `Integration.credentialReference` since these represent a different kind of thing (LLM provider access, not external tool integration). |
| DEVOS-313 | Validation, documentation, and gap disclosure | Full monorepo validation green; explicit written confirmation that no existing route's or agent task's behavior changed — this sprint only adds dormant data model and resolver capability. |

### 5.2 Sprint 53 — Provider Gateway & Per-Task Resolution (DEVOS-314–318)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-314 | A real provider registry / `AgentModelAdapter` factory in `packages/agents` | Replaces the single `createGeminiModelAdapter({ apiKey })` call with a provider-keyed factory; Gemini becomes one registered provider among others, not a hardcoded special case. |
| DEVOS-315 | A second real provider adapter | A concrete second `AgentModelAdapter` implementation (provider TBD — confirm at conversion time, since the user's own choice of provider wasn't part of this scoping conversation), proving the registry is real, not aspirational, mirroring DEVOS-195's own "second real adapter behind the same port" precedent (GitLab alongside GitHub). |
| DEVOS-316 | Per-task adapter resolution, replacing the boot-time constant | `AgentInvocationRequest`/`run-agent-task.ts` widened to carry `organisationId` (already resolvable via `project.organisationId`, the same value the existing cost-alert code already uses); `apps/worker/src/main.ts`'s top-level `modelAdapter` const (§2.1) is replaced with real per-task resolution. The disclosed, real architecture change this epic exists to make. |
| DEVOS-317 | Per-provider pricing | `packages/agents/src/pricing.ts`'s existing flat, Gemini-only rate table widens to a real per-provider/per-model table, feeding `AgentExecution.estimatedCostUsd` unchanged in spirit (§9.6 — stays informational). |
| DEVOS-318 | Validation, documentation, and gap disclosure | Full monorepo validation green; a real task run against each registered provider confirmed to invoke the correct one. |

### 5.3 Sprint 54 — Ranked Fallback & Access Control UI (DEVOS-319–322)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-319 | Ranked fallback-chain resolution | For a given organisation, providers are tried in `priority` order; an unconfigured/disabled/failing entry falls through to the next; if none succeed (or none are configured at all), falls back to the platform-wide default (today's single `GEMINI_API_KEY` env var, preserved for self-hosted/dev use) — the resolved cascading-fallback decision (§9.3), deterministic and disclosed, matching this codebase's own established selection-algorithm discipline. |
| DEVOS-320 | Access-role gating | Managing an organisation's provider list is gated to `OWNER`/`ORGANISATION_ADMIN` only (§9.4) — reusing E29's existing organisation-admin write gate (`resolveOrganisationAdminMembership`, Sprint 51) if it fits directly; a new narrow permission is added only if it doesn't, decided and disclosed during implementation. |
| DEVOS-321 | Organisation settings UI — "AI Providers" panel | Add/remove/reorder providers, a masked credential-reference field (never displays a resolved secret, per `AGENTS.md` §22), active/disabled toggle. Mirrors `OrganisationsPage.tsx`'s existing membership-management UI conventions (Sprint 39/47's own precedent). |
| DEVOS-322 | Validation, documentation, and gap disclosure | Full monorepo validation green; live-verified fallback ordering and access gating against real Postgres. |

### 5.4 Sprint 55 — Full-Epic Pilot & Close-Out (DEVOS-323–324)

| ID | Story | Acceptance summary |
| --- | --- | --- |
| DEVOS-323 | Real end-to-end pilot | A real organisation configured with 2+ real providers; the top-priority one deliberately made to fail/be unconfigured; confirms the fallback chain genuinely falls through to the next real provider, the resulting `AgentExecution.estimatedCostUsd` reflects the provider actually used (not the top-priority one), and the choice is audit-recorded. |
| DEVOS-324 | Final validation, documentation, and closing disclosure | Full monorepo `pnpm turbo run typecheck lint test build` and the full real `tests/e2e` suite green; a single written closing disclosure of everything deliberately left out of scope (per-user credentials, project-level credentials, cost/quality/latency-based dynamic routing, automatic budget cutoff). |

---

## 6. Dependencies

- Sprint 53 depends on Sprint 52's data model and widened resolver existing to resolve against.
- Sprint 54's fallback chain and UI depend on Sprint 53's real per-task resolution existing to route through — a fallback chain over a boot-time constant would be meaningless.
- Sprint 55 depends on all three prior sprints.

## 7. Definition of Done

- Every acceptance summary in §5 independently, really verified against a real running system and real Postgres data — not asserted from code review alone.
- Full monorepo validation stays green after every sprint, including confirmation that Sprint 52's own data-model addition changes zero existing behavior before Sprint 53 makes the resolution path real.
- `DEVOS-BUILD-STATE.md`/`DEVOS-ROADMAP.md` are updated only on the user's explicit approval of each step, per `AGENTS.md` §18/§19 — this document does not authorize touching either.

---

## 8. What's still an open, small decision (deliberately not blocking scoping)

- **Which second provider to build first** (DEVOS-315) — Anthropic, OpenAI, and Azure OpenAI are all plausible; not part of this scoping conversation. Flagged for confirmation at Sprint 53 conversion time, the same way several prior sprints (e.g. Sprint 17's cost-dashboard placement) left one named implementation choice to be decided and disclosed during the sprint itself rather than blocking approval of the sprint's shape.

---

## 9. Decisions

All open forks from v1.0 (§4) have been resolved by the user. Recorded here, per `AGENTS.md` §28 (auditability) — preserved as history, not deleted, even though resolved.

1. **Credential scope.** Resolved: **organisation-only.** No project-level override, no per-user credential. Matches the existing `Organisation.budgetUsd` cost-scope precedent (§2.5) exactly; avoids the per-user anchor problem entirely (v1.0 §4.2 is moot as a result and is not carried forward).
2. **Provider breadth.** Resolved: **full multi-provider gateway**, not a single-provider key swap. This epic and the never-built "AI Model Gateway" (§2.3) are confirmed to be the same piece of work.
3. **Fallback order.** Resolved: **cascading fallback** — organisation's ranked provider list, falling through to the platform-wide default (today's env var) if none are configured or all fail.
4. **Who can configure a credential.** Resolved: **organisation `OWNER`/`ORGANISATION_ADMIN` only**, reusing E29's existing access-role catalogue as directly as implementation allows (DEVOS-320).
5. **Provider selection granularity.** Resolved in two steps: first, "multiple providers per org, selectable per-agent/task" (not one provider per org); then, clarified as **manual, admin-set ranked preference** rather than dynamic cost/quality/latency-based routing — i.e., an ordered fallback chain (§9.3), not a selection algorithm. This deliberately does not build `DEVOS-AGENT-SELECTION-BACKLOG.md`'s own still-deferred cost-aware selection work; it only produces real per-provider pricing data (DEVOS-317) that a future version of that work could eventually consume.
6. **Cost-attribution interaction.** Resolved: `estimatedCostUsd`/`budgetUsd` tracking **stays as-is, informational**, regardless of whose credential/provider was actually used.
7. **Storage backend.** Not separately re-litigated — confirmed as part of §9.2/§9.4's resolution: `CredentialResolver`'s existing env/Vault mechanism, widened in scope (DEVOS-312), not replaced.

Per `AGENTS.md` §35/§4.2, this document's decisions being resolved does **not** itself authorize conversion to `specs/sprints/sprint-52/` or any implementation — that is a separate, explicit approval, still pending.

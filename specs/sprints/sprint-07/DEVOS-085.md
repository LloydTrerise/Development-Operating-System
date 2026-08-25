# DEVOS-085 — Agent/tool security controls

**Priority:** P0 | **Estimate:** 1d
**Depends on:** DEVOS-082.

## Scope

"Capability restrictions and escalation tests" (source, verbatim). Confirmed by inspection: `AgentVersion.configuration.allowedCapabilities` (`packages/contracts/src/agents.ts`) is validated as an array of strings on input and stored, but `invokeTool` (`packages/tools/src/gateway/invoke-tool.ts`) has no awareness of which agent, if any, is behind a given invocation — the field is never enforced anywhere at runtime. This task threads the invoking agent's `allowedCapabilities` into the Tool Gateway call chain and adds a new enforcement step.

## Grounding

`specs/constitution/devos-engineering-constitution.md` Principle 6 ("Security Is Outside the Model") and Principle 7 ("Controlled External Actions") — an agent must not be able to act outside its granted authority regardless of what the model outputs.

## Flagged gap

The Tool Gateway chain (Typed Validation → Project Scope → Policy → Capability Permission → Credential Resolution → Provider Adapter) already has a "Capability Permission" step (DEVOS-048), but it checks policy-based capability permission, not agent-specific `allowedCapabilities`. This task adds agent-capability enforcement as an additional, explicit check — not a replacement for the existing policy check.

## Acceptance

A test constructs an agent whose `allowedCapabilities` excludes a given capability, invokes a tool of that capability through the real agent-task execution path, and asserts the invocation is rejected (not merely that policy evaluation returns deny for an unrelated reason). A second test confirms a capability included in `allowedCapabilities` still succeeds.

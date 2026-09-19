# DEVOS-158 — Role/capability node targeting (contract + validation)

**Priority:** P0 | **Estimate:** 1.5d
**Depends on:** none (extends existing `WorkflowNode`/`validateWorkflowDefinition`).
**Depended on by:** DEVOS-159 (selection algorithm reads these fields), DEVOS-160 (inspector authors them), DEVOS-161 (pilot exercises them).

## Scope

`WorkflowNode` gains `requiredRole?: string` and `requiredCapabilities?: string[]`, an alternative to `agentRef` for `AGENT_TASK` nodes. `validateWorkflowDefinition` accepts an `AGENT_TASK` node with either a non-empty `agentRef` OR a non-empty `requiredRole` — not both required. A node with neither still fails validation exactly as today.

## Implementation

- `packages/contracts/src/workflows.ts`: add `requiredRole?: string; requiredCapabilities?: string[];` to `WorkflowNode`, alongside the existing `agentRef?: string`.
- `packages/domain/src/workflows/validation.ts`: change the existing `AGENT_TASK` check (currently `typeof n.agentRef !== 'string' || n.agentRef.trim().length === 0` → always an issue) to only be an issue when **both** `agentRef` is empty/absent **and** `requiredRole` is empty/absent. `requiredCapabilities` stays optional even when `requiredRole` is set (an empty/absent array means "role match only, no capability filter").
- No change to any other node type's validation.

## Out of scope

Any change to how `agentRef`-only nodes are resolved at run time (DEVOS-159's job). Any UI change (DEVOS-160's job).

## Acceptance

An `AGENT_TASK` node with only `agentRef` set still validates exactly as before (existing `workflow-validation.test.ts` cases pass unmodified). A new test: an `AGENT_TASK` node with only `requiredRole` set (no `agentRef`) validates with zero issues. A new test: an `AGENT_TASK` node with neither set still produces the same validation issue it does today. `pnpm --filter @devos/contracts --filter @devos/domain typecheck test` green.

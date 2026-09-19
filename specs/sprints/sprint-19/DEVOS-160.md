# DEVOS-160 — Designer support for capability-based nodes

**Priority:** P1 | **Estimate:** 1.5d
**Depends on:** DEVOS-158 (fields to author), DEVOS-159 (so an authored node is actually resolvable at run time).
**Depended on by:** DEVOS-161 (pilot authors a node through this UI or an equivalent direct API call — whichever the implementation finds cleaner to verify for real).

## Scope

The existing `AGENT_TASK` node inspector gains a real second targeting mode: declare `requiredRole` + `requiredCapabilities` instead of picking a literal agent, reusing the existing inspector component.

## Implementation

- Locate the current `AGENT_TASK` inspector fields in `apps/web` (the same properties-inspector component Sprint 13/14 built for `CONDITION`/`PARALLEL`/`WAIT`/`APPROVAL` node config).
- Add a mode toggle: "Specific agent" (existing literal `agentRef` picker, unchanged default) vs. "By role/capability" (a role text input plus a repeatable capability-string list, writing `requiredRole`/`requiredCapabilities` instead of `agentRef`).
- Client-side validation mirrors DEVOS-158's rule: exactly one of the two modes' required fields must be filled before save is allowed, matching the existing client-side validation pattern already used for other node types.

## Out of scope

Any agent/capability autocomplete or live-candidate-preview in the inspector (would require a new "preview candidates" API call — real value, but a separate concern from making the field authorable at all). A new node type.

## Acceptance

A user can create an `AGENT_TASK` node in "By role/capability" mode and save a valid draft without ever picking a literal agent; switching back to "Specific agent" mode clears the role/capability fields (or the reverse), matching whichever mutual-exclusivity UX the existing inspector's own established pattern for similar per-node-type alternatives already uses. Manually verified in a real running `apps/web` dev server against a real running `apps/api`.

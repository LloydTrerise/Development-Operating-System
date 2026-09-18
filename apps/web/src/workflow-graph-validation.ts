import { useEffect, useState } from 'react';
import { validateWorkflowGraph, type WorkflowValidationIssue } from '@devos/domain';
import type { WorkflowEdge, WorkflowNode } from './api-client.js';

const DEBOUNCE_MS = 300;

export interface ValidatableGraph {
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

/**
 * DEVOS-131: real-time structural validation using the exact same real
 * `validateWorkflowGraph` (`packages/domain/src/workflows/validation.ts`)
 * that `createProjectTypeWorkflow`/`updateProjectTypeWorkflow` already,
 * separately, and non-negotiably re-run server-side on save. This is
 * additive, instant, (after a debounce) zero-round-trip client-side
 * feedback — never a replacement for that real enforcement point
 * (Designer spec ADR-WD-004: "client validation cannot be the security or
 * correctness boundary"). `validateWorkflowGraph` only reads `name`/
 * `nodes`/`edges` (confirmed by reading it directly) — the `trigger`/
 * `inputs`/`policies`/`outputs` a real published graph also carries are
 * irrelevant to it and deliberately omitted from `ValidatableGraph`.
 *
 * This is the first `apps/web` import of `@devos/domain` — confirmed safe
 * empirically (real `tsc`/`eslint`/`vite build` and a real dev-server
 * fetch of the transformed module all clean) rather than assumed; see
 * `specs/sprints/sprint-13/DEVOS-131.md` for the fallback this would have
 * required had it not been.
 */
export function useWorkflowGraphValidation(graph: ValidatableGraph): WorkflowValidationIssue[] {
  const [issues, setIssues] = useState<WorkflowValidationIssue[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIssues(validateWorkflowGraph(graph));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [graph]);

  return issues;
}

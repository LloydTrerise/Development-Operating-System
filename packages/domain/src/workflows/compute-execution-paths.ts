import type {
  WorkflowDefinition as WorkflowGraph,
  WorkflowEdge,
  WorkflowNode,
} from '@devos/contracts';

/**
 * DEVOS-134 (Sprint 14): a real, static computation over an already-
 * validated graph's own declared edges — the same edges `run-creation.ts`
 * (`packages/application/src/workflows/`) already treats as real ordering
 * (a node's own `dependsOn` is computed from its incoming edges), just
 * traversed here for preview rather than at run-start. Per the Designer
 * spec's own explicit warning (§30), this is a structural preview, never a
 * guarantee of what will actually happen at runtime — a `TOOL_TASK`'s real
 * behaviour, a `CONDITION`'s real evaluated branch, and a `JOIN`'s real
 * partial-failure tolerance are all runtime facts this function cannot see.
 *
 * A real, disclosed narrowing of the Designer spec's own "happy/failure/
 * approval/parallel" taxonomy (§29): this engine has no concept of a
 * "failure path" as a distinct graph shape (a `JOIN`'s `branchFailurePolicy`
 * is a runtime behavior, not a separate edge/path) — labeling a computed
 * path as "failure" would fabricate a classification the graph itself
 * doesn't express. Paths are labeled only from real graph facts instead:
 * which `CONDITION` branch (if any) they follow, and whether they pass
 * through an `APPROVAL` node or a `PARALLEL`/`JOIN` pair.
 */
export interface ExecutionPath {
  /** The ordered node ids this path visits, root to terminal. */
  nodeIds: string[];
  /** Every `CONDITION` branch key taken along this path, in order. */
  branchesTaken: string[];
  passesThroughApproval: boolean;
  passesThroughParallelOrJoin: boolean;
}

function outgoingEdges(edges: WorkflowEdge[], nodeId: string): WorkflowEdge[] {
  return edges.filter((edge) => edge.from === nodeId);
}

function hasIncomingEdge(edges: WorkflowEdge[], nodeId: string): boolean {
  return edges.some((edge) => edge.to === nodeId);
}

/**
 * Depth-first from `nodeId`, emitting one complete path per route to a
 * terminal node (no outgoing edges). Every node with more than one outgoing
 * edge (`CONDITION`'s real branches, or a `PARALLEL`'s real fan-out) starts
 * a separate path per edge — a `JOIN` is otherwise a plain pass-through
 * node in this traversal, the same way it is in the real engine's own
 * `dependsOn` computation. `visited` guards against an authored cycle
 * (this engine's own `validateWorkflowGraph` never required a DAG) by
 * simply not re-entering an already-visited node within the same path,
 * rather than looping forever.
 */
function traverse(
  nodesById: Map<string, WorkflowNode>,
  edges: WorkflowEdge[],
  nodeId: string,
  visited: ReadonlySet<string>,
  soFar: ExecutionPath,
  onComplete: (path: ExecutionPath) => void,
): void {
  const node = nodesById.get(nodeId);
  if (!node || visited.has(nodeId)) {
    onComplete(soFar);
    return;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);
  const nextPath: ExecutionPath = {
    nodeIds: [...soFar.nodeIds, nodeId],
    branchesTaken: soFar.branchesTaken,
    passesThroughApproval: soFar.passesThroughApproval || node.type === 'APPROVAL',
    passesThroughParallelOrJoin:
      soFar.passesThroughParallelOrJoin || node.type === 'PARALLEL' || node.type === 'JOIN',
  };

  const outgoing = outgoingEdges(edges, nodeId);
  if (outgoing.length === 0) {
    onComplete(nextPath);
    return;
  }

  for (const edge of outgoing) {
    const branchPath: ExecutionPath =
      edge.branch !== undefined
        ? { ...nextPath, branchesTaken: [...nextPath.branchesTaken, edge.branch] }
        : nextPath;
    traverse(nodesById, edges, edge.to, nextVisited, branchPath, onComplete);
  }
}

export function computeExecutionPaths(graph: WorkflowGraph): ExecutionPath[] {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const roots = graph.nodes.filter((node) => !hasIncomingEdge(graph.edges, node.id));

  const paths: ExecutionPath[] = [];
  for (const root of roots) {
    traverse(
      nodesById,
      graph.edges,
      root.id,
      new Set(),
      {
        nodeIds: [],
        branchesTaken: [],
        passesThroughApproval: false,
        passesThroughParallelOrJoin: false,
      },
      (path) => paths.push(path),
    );
  }

  return paths;
}

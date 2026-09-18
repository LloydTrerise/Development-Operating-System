import { useCallback, useMemo, type DragEvent } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowEdge, WorkflowNode } from '../api-client.js';
import { PALETTE_DRAG_MIME_TYPE } from './WorkflowPalette.js';

/**
 * DEVOS-128/129: the canvas foundation `specs/architecture/organisations-and-project-types.md`
 * §12.2 named and deferred, now also real node/edge creation — dragging a
 * `WorkflowPalette` item onto the canvas creates a real `WorkflowNode`;
 * connecting two nodes creates a real `WorkflowEdge`. A real properties
 * inspector (DEVOS-130) remains out of scope here — a freshly-created
 * node's own per-type `config` is still only editable via the table fields
 * below the canvas until that task lands.
 *
 * A node's on-canvas position has no equivalent anywhere in
 * `@devos/contracts`' `WorkflowNode` — stored additively in
 * `node.config.canvasPosition`, the same generic per-node extension point
 * `CONDITION`/`JOIN`/`WAIT`/`APPROVAL` already use for their own real
 * config, so an unpositioned (e.g. freshly seeded) graph still validates
 * and simply falls back to a deterministic grid layout.
 */

const GRID_COLUMNS = 4;
const GRID_CELL_WIDTH = 220;
const GRID_CELL_HEIGHT = 140;

function defaultPosition(index: number): { x: number; y: number } {
  return {
    x: (index % GRID_COLUMNS) * GRID_CELL_WIDTH,
    y: Math.floor(index / GRID_COLUMNS) * GRID_CELL_HEIGHT,
  };
}

function readCanvasPosition(node: WorkflowNode): { x: number; y: number } | undefined {
  const position = node.config?.canvasPosition;
  if (
    typeof position === 'object' &&
    position !== null &&
    typeof (position as { x?: unknown }).x === 'number' &&
    typeof (position as { y?: unknown }).y === 'number'
  ) {
    return position as { x: number; y: number };
  }
  return undefined;
}

function toFlowNodes(nodes: WorkflowNode[]): Node[] {
  return nodes.map((node, index) => ({
    id: node.id.length > 0 ? node.id : `__unnamed-${index}`,
    position: readCanvasPosition(node) ?? defaultPosition(index),
    data: { label: `${node.name && node.name.length > 0 ? node.name : node.id}\n(${node.type})` },
  }));
}

function toFlowEdges(edges: WorkflowEdge[]): Edge[] {
  return edges.map((edge, index) => ({
    id: `${index}-${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    ...(edge.branch !== undefined ? { label: edge.branch } : {}),
  }));
}

/**
 * A new palette-created node must not collide with an existing node's own
 * real `id` (`validateWorkflowGraph`'s own duplicate-id check would reject
 * it server-side regardless, but rejecting it here means an author never
 * even sees an invalid graph state, matching `specs/sprints/sprint-13/DEVOS-129.md`'s
 * own acceptance).
 */
function generateUniqueNodeId(type: string, existingIds: ReadonlySet<string>): string {
  const base = type.toLowerCase();
  let suffix = 1;
  let candidate = `${base}-${suffix}`;
  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

export interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  /** Called with the same `nodes` array, each real node's own `config.canvasPosition` updated to match a real drag. */
  onNodesReposition: (nodes: WorkflowNode[]) => void;
  /** Called with a real new `WorkflowNode` (a unique `id`, the dropped `type`, a real `config.canvasPosition`) when a palette item is dropped onto the canvas. */
  onNodeCreate: (node: WorkflowNode) => void;
  /** Called with a real new `WorkflowEdge` when two nodes are connected on the canvas. */
  onEdgeCreate: (edge: WorkflowEdge) => void;
  /** DEVOS-130: the real node id last clicked on the canvas, driving the properties inspector. */
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
}

function CanvasInner({
  nodes,
  edges,
  onNodesReposition,
  onNodeCreate,
  onEdgeCreate,
  selectedNodeId,
  onNodeSelect,
}: WorkflowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const flowNodes = useMemo(
    () => toFlowNodes(nodes).map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [nodes, selectedNodeId],
  );
  const flowEdges = useMemo(() => toFlowEdges(edges), [edges]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updatedFlowNodes = applyNodeChanges(changes, flowNodes);
      const positionById = new Map(updatedFlowNodes.map((node) => [node.id, node.position]));
      onNodesReposition(
        nodes.map((node, index) => {
          const flowId = node.id.length > 0 ? node.id : `__unnamed-${index}`;
          const position = positionById.get(flowId);
          if (!position) return node;
          return { ...node, config: { ...node.config, canvasPosition: position } };
        }),
      );
    },
    [flowNodes, nodes, onNodesReposition],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        onEdgeCreate({ from: connection.source, to: connection.target });
      }
    },
    [onEdgeCreate],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData(PALETTE_DRAG_MIME_TYPE);
      if (!nodeType) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const existingIds = new Set(nodes.map((node) => node.id));
      const id = generateUniqueNodeId(nodeType, existingIds);
      onNodeCreate({ id, type: nodeType, config: { canvasPosition: position } });
    },
    [nodes, onNodeCreate, screenToFlowPosition],
  );

  return (
    <div
      style={{ height: 480, border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: 4 }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onNodeClick={(_event, node) => onNodeSelect(node.id)}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

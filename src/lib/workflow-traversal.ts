import type {
  DecisionNode,
  WorkflowEdge,
  WorkflowGraph,
} from "@/lib/types";

export const MAX_WORKFLOW_STEPS = 25;

export function findStartNode(graph: WorkflowGraph): DecisionNode {
  const nodesWithIncomingEdges = new Set(
    graph.edges.map((edge) => edge.target),
  );
  const startNode = graph.nodes.find(
    (node) => !nodesWithIncomingEdges.has(node.id),
  );

  if (!startNode) {
    throw new Error("Workflow has no start node.");
  }

  return startNode;
}

export function findNextNode(
  edges: WorkflowEdge[],
  sourceNodeId: string,
  answer: "YES" | "NO",
): string | null {
  const branchType = answer.toLowerCase();
  return (
    edges.find(
      (edge) => edge.source === sourceNodeId && edge.type === branchType,
    )?.target ?? null
  );
}

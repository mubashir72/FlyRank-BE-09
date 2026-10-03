import type { WorkflowGraph } from "@/lib/types";

const STORAGE_KEY = "branch-workflow-graph";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isWorkflowGraph(value: unknown): value is WorkflowGraph {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) return false;

  const nodeIds = new Set<string>();
  for (const node of value.nodes as unknown[]) {
    if (!isRecord(node) || !isRecord(node.position) || !isRecord(node.data)) {
      return false;
    }
    if (
      typeof node.id !== "string" ||
      !node.id ||
      nodeIds.has(node.id) ||
      node.type !== "decision" ||
      typeof node.position.x !== "number" ||
      !Number.isFinite(node.position.x) ||
      typeof node.position.y !== "number" ||
      !Number.isFinite(node.position.y) ||
      typeof node.data.title !== "string" ||
      typeof node.data.prompt !== "string"
    ) {
      return false;
    }
    nodeIds.add(node.id);
  }

  const edgeIds = new Set<string>();
  for (const edge of value.edges as unknown[]) {
    if (
      !isRecord(edge) ||
      typeof edge.id !== "string" ||
      !edge.id ||
      edgeIds.has(edge.id) ||
      typeof edge.source !== "string" ||
      !nodeIds.has(edge.source) ||
      typeof edge.target !== "string" ||
      !nodeIds.has(edge.target) ||
      (edge.type !== "yes" && edge.type !== "no") ||
      edge.sourceHandle !== edge.type
    ) {
      return false;
    }
    edgeIds.add(edge.id);
  }

  return true;
}

export function loadWorkflowGraph(): WorkflowGraph | null {
  try {
    const savedGraph = window.localStorage.getItem(STORAGE_KEY);
    if (!savedGraph) return null;

    const parsed: unknown = JSON.parse(savedGraph);
    if (!isWorkflowGraph(parsed)) {
      throw new Error("Saved workflow graph has an invalid shape.");
    }

    return parsed;
  } catch (error) {
    console.error("Unable to restore the workflow from local storage.", error);
    return null;
  }
}

export function saveWorkflowGraph(graph: WorkflowGraph): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(graph));
  } catch (error) {
    console.error("Unable to save the workflow to local storage.", error);
  }
}

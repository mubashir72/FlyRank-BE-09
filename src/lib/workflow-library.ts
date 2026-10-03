import type {
  SavedWorkflow,
  WorkflowGraph,
  WorkflowHistoryEntry,
} from "@/lib/types";
import { WorkflowGraphSchema } from "@/lib/workflow-schemas";
import { isWorkflowGraph } from "@/lib/storage";

const WORKFLOWS_KEY = "branch-saved-workflows";
const HISTORY_KEY = "branch-run-history";
const HISTORY_LIMIT = 20;

function readArray<T>(key: string, validator: (value: unknown) => value is T): T[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value) || !value.every(validator)) {
      throw new Error(`Stored data in "${key}" is invalid.`);
    }
    return value;
  } catch (error) {
    console.error(`Unable to load "${key}" from local storage.`, error);
    return [];
  }
}

function isSavedWorkflow(value: unknown): value is SavedWorkflow {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    typeof item.updatedAt === "string" &&
    WorkflowGraphSchema.safeParse(item.graph).success
  );
}

function isHistoryEntry(value: unknown): value is WorkflowHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.runId === "string" &&
    typeof item.input === "string" &&
    typeof item.startedAt === "string" &&
    (item.status === "running" ||
      item.status === "completed" ||
      item.status === "failed") &&
    WorkflowGraphSchema.safeParse(item.graph).success &&
    Array.isArray(item.trace) &&
    Array.isArray(item.logs)
  );
}

export function loadSavedWorkflows(): SavedWorkflow[] {
  return readArray(WORKFLOWS_KEY, isSavedWorkflow);
}

export function saveNamedWorkflow(
  name: string,
  graph: WorkflowGraph,
): SavedWorkflow[] {
  const workflows = loadSavedWorkflows();
  const normalizedName = name.trim();
  const existing = workflows.find(
    (workflow) => workflow.name.toLowerCase() === normalizedName.toLowerCase(),
  );
  const nextWorkflow: SavedWorkflow = {
    id: existing?.id ?? crypto.randomUUID(),
    name: normalizedName,
    graph,
    updatedAt: new Date().toISOString(),
  };
  const updated = [
    nextWorkflow,
    ...workflows.filter((workflow) => workflow.id !== existing?.id),
  ];
  window.localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteSavedWorkflow(id: string): SavedWorkflow[] {
  const updated = loadSavedWorkflows().filter((workflow) => workflow.id !== id);
  window.localStorage.setItem(WORKFLOWS_KEY, JSON.stringify(updated));
  return updated;
}

export function loadRunHistory(): WorkflowHistoryEntry[] {
  return readArray(HISTORY_KEY, isHistoryEntry).slice(0, HISTORY_LIMIT);
}

export function saveRunHistoryEntry(
  entry: WorkflowHistoryEntry,
): WorkflowHistoryEntry[] {
  const updated = [
    entry,
    ...loadRunHistory().filter((run) => run.runId !== entry.runId),
  ]
    .sort(
      (left, right) =>
        new Date(right.startedAt).getTime() -
        new Date(left.startedAt).getTime(),
    )
    .slice(0, HISTORY_LIMIT);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

export function toWorkflowGraph(value: unknown): WorkflowGraph {
  const parsed = WorkflowGraphSchema.parse(value);
  if (!isWorkflowGraph(parsed)) {
    throw new Error("Graph contains unsupported React Flow data.");
  }
  return parsed;
}

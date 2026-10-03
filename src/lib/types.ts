import type { Edge, Node } from "@xyflow/react";

export type DecisionNodeData = {
  title: string;
  prompt: string;
  executionStatus?: "idle" | "running" | "completed" | "failed";
  executionAnswer?: "YES" | "NO";
  executionOrder?: number;
};

export type DecisionNode = Node<DecisionNodeData, "decision">;
export type WorkflowEdge = Edge;

export type WorkflowGraph = {
  nodes: DecisionNode[];
  edges: WorkflowEdge[];
};

export type WorkflowRunStatus = "running" | "completed" | "failed";

export type WorkflowTraceEntry = {
  nodeId: string;
  title: string;
  prompt: string;
  answer: "YES" | "NO";
  timestamp: string;
  order: number;
  durationMs: number;
};

export type WorkflowLogEntry = {
  nodeId: string;
  title: string;
  prompt: string;
  status: "running" | "completed" | "failed";
  timestamp: string;
  answer?: "YES" | "NO";
  durationMs?: number;
  error?: string;
  order: number;
};

export type WorkflowRunState = {
  runId: string;
  parentRunId?: string;
  graph: WorkflowGraph;
  input: string;
  startedAt: string;
  status: WorkflowRunStatus;
  trace: WorkflowTraceEntry[];
  logs: WorkflowLogEntry[];
  activeNodeId: string | null;
  failedNodeId: string | null;
  finalNode: { id: string; title: string } | null;
  error?: string;
};

export type SavedWorkflow = {
  id: string;
  name: string;
  graph: WorkflowGraph;
  updatedAt: string;
};

export type WorkflowHistoryEntry = Pick<
  WorkflowRunState,
  | "runId"
  | "parentRunId"
  | "graph"
  | "input"
  | "startedAt"
  | "status"
  | "trace"
  | "logs"
  | "activeNodeId"
  | "failedNodeId"
  | "finalNode"
  | "error"
>;

import type {
  WorkflowGraph,
  WorkflowLogEntry,
  WorkflowRunState,
  WorkflowTraceEntry,
} from "@/lib/types";

type RunStore = Map<string, WorkflowRunState>;

const globalForRuns = globalThis as typeof globalThis & {
  __branchWorkflowRuns?: RunStore;
};

const runs = (globalForRuns.__branchWorkflowRuns ??= new Map());

export function createWorkflowRun(args: {
  runId: string;
  graph: WorkflowGraph;
  input: string;
  trace?: WorkflowTraceEntry[];
  logs?: WorkflowLogEntry[];
  parentRunId?: string;
}): WorkflowRunState {
  const run: WorkflowRunState = {
    ...args,
    startedAt: new Date().toISOString(),
    status: "running",
    trace: args.trace ?? [],
    logs: args.logs ?? [],
    activeNodeId: null,
    failedNodeId: null,
    finalNode: null,
  };
  runs.set(args.runId, run);
  return run;
}

export function getWorkflowRun(runId: string): WorkflowRunState | undefined {
  return runs.get(runId);
}

export function updateWorkflowRun(
  runId: string,
  update: (run: WorkflowRunState) => WorkflowRunState,
): void {
  const currentRun = runs.get(runId);
  if (!currentRun) {
    throw new Error(`Workflow run "${runId}" is not available in this process.`);
  }

  runs.set(runId, update(currentRun));
}

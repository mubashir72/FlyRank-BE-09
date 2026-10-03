import { inngest } from "@/inngest/client";
import { executeDecisionNode } from "@/lib/decision-model";
import { getWorkflowRun, updateWorkflowRun } from "@/lib/workflow-run-store";
import {
  findNextNode,
  findStartNode,
  MAX_WORKFLOW_STEPS,
} from "@/lib/workflow-traversal";
import type {
  DecisionNode,
  WorkflowGraph,
  WorkflowLogEntry,
  WorkflowTraceEntry,
} from "@/lib/types";

type WorkflowRunEvent = {
  name: "workflow/run";
  data: {
    runId: string;
    graph: WorkflowGraph;
    input: string;
    startNodeId?: string;
    initialTrace?: WorkflowTraceEntry[];
  };
};

export const runWorkflow = inngest.createFunction(
  {
    id: "run-workflow",
    triggers: [{ event: "workflow/run" }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const failureData = event.data as {
        event?: { data?: { runId?: unknown } };
      };
      const runId = failureData.event?.data?.runId;
      if (typeof runId !== "string") {
        console.error("Inngest workflow failure event has no runId.", error);
        return;
      }

      const run = getWorkflowRun(runId);
      if (!run) {
        console.error(`Failed workflow run "${runId}" is not in this process.`);
        return;
      }
      const failedNode = run.graph.nodes.find(
        (node) => node.id === run.activeNodeId,
      );
      const timestamp = new Date().toISOString();
      const runningLog = [...run.logs]
        .reverse()
        .find(
          (log) =>
            log.nodeId === run.activeNodeId && log.status === "running",
        );
      const message =
        error instanceof Error ? error.message : "Workflow execution failed.";

      updateWorkflowRun(runId, (current) => ({
        ...current,
        status: "failed",
        activeNodeId: null,
        failedNodeId: failedNode?.id ?? current.activeNodeId,
        error: message,
        logs: failedNode
          ? [
              ...current.logs.filter(
                (log) =>
                  !(
                    log.nodeId === failedNode.id &&
                    log.status === "running"
                  ),
              ),
              {
                nodeId: failedNode.id,
                title: failedNode.data.title,
                prompt: failedNode.data.prompt,
                status: "failed",
                timestamp,
                durationMs: runningLog
                  ? Date.now() - new Date(runningLog.timestamp).getTime()
                  : 0,
                error: message,
                order: current.trace.length + 1,
              },
            ]
          : [
              ...current.logs,
              {
                nodeId: "workflow",
                title: "Workflow",
                prompt: "",
                status: "failed",
                timestamp,
                error: message,
                order: current.logs.length + 1,
              },
            ],
      }));
    },
  },
  async ({ event, step }) => {
    const {
      runId,
      graph,
      input,
      startNodeId,
      initialTrace = [],
    } = event.data as WorkflowRunEvent["data"];
    const visited = new Set(initialTrace.map((entry) => entry.nodeId));
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
    const trace = [...initialTrace];
    const firstNode = startNodeId
      ? nodesById.get(startNodeId)
      : findStartNode(graph);

    if (!firstNode) {
      throw new Error(`Workflow start node "${startNodeId}" does not exist.`);
    }
    let currentNode: DecisionNode = firstNode;

    for (let order = trace.length + 1; order <= MAX_WORKFLOW_STEPS; order += 1) {
      if (visited.has(currentNode.id)) {
        updateWorkflowRun(runId, (run) => ({
          ...run,
          activeNodeId: currentNode.id,
        }));
        throw new Error(`Workflow cycle detected at node "${currentNode.id}".`);
      }
      visited.add(currentNode.id);

      const startedAt = new Date().toISOString();
      updateWorkflowRun(runId, (run) => ({
        ...run,
        status: "running",
        activeNodeId: currentNode.id,
        failedNodeId: null,
        error: undefined,
        logs: [
          ...run.logs.filter(
            (log) =>
              !(log.nodeId === currentNode?.id && log.status === "running"),
          ),
          {
            nodeId: currentNode.id,
            title: currentNode.data.title,
            prompt: currentNode.data.prompt,
            status: "running",
            timestamp: startedAt,
            order,
          },
        ],
      }));

      const decision = await step.run(
        `node-${currentNode.id}-${runId}`,
        async () => {
          const started = Date.now();
          const answer = await executeDecisionNode(currentNode, input);
          return {
            answer,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - started,
          };
        },
      );

      const entry: WorkflowTraceEntry = {
        nodeId: currentNode.id,
        title: currentNode.data.title,
        prompt: currentNode.data.prompt,
        answer: decision.answer,
        timestamp: decision.timestamp,
        order,
        durationMs: decision.durationMs,
      };
      trace.push(entry);
      const completedLog: WorkflowLogEntry = {
        ...entry,
        status: "completed",
      };
      updateWorkflowRun(runId, (run) => ({
        ...run,
        trace: [...trace],
        logs: [
          ...run.logs.filter(
            (log) =>
              !(log.nodeId === currentNode.id && log.status === "running"),
          ),
          completedLog,
        ],
      }));

      const nextNodeId = findNextNode(
        graph.edges,
        currentNode.id,
        decision.answer,
      );
      if (!nextNodeId) {
        updateWorkflowRun(runId, (run) => ({
          ...run,
          status: "completed",
          activeNodeId: null,
          failedNodeId: null,
          finalNode: { id: currentNode.id, title: currentNode.data.title },
          trace: [...trace],
          logs: [...run.logs],
        }));
        return {
          runId,
          trace,
          finalNode: { id: currentNode.id, title: currentNode.data.title },
        };
      }

      const nextNode = nodesById.get(nextNodeId);
      if (!nextNode) {
        throw new Error(`Workflow edge points to missing node "${nextNodeId}".`);
      }
      currentNode = nextNode;
    }

    updateWorkflowRun(runId, (run) => ({ ...run, activeNodeId: null }));
    throw new Error(`Workflow exceeded the ${MAX_WORKFLOW_STEPS}-step limit.`);
  },
);

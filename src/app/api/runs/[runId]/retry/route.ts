import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { getWorkflowRun, createWorkflowRun, updateWorkflowRun } from "@/lib/workflow-run-store";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { runId: string } },
) {
  const failedRun = getWorkflowRun(params.runId);
  if (!failedRun) {
    return NextResponse.json(
      { error: "Workflow run not found in this server process." },
      { status: 404 },
    );
  }
  if (failedRun.status !== "failed" || !failedRun.failedNodeId) {
    return NextResponse.json(
      { error: "Only runs with a failed node can be retried." },
      { status: 409 },
    );
  }

  const retryNode = failedRun.graph.nodes.find(
    (node) => node.id === failedRun.failedNodeId,
  );
  if (!retryNode) {
    return NextResponse.json(
      { error: "The failed node is missing from the saved run graph." },
      { status: 409 },
    );
  }

  const completedTrace = failedRun.trace;
  const completedIds = new Set(completedTrace.map((entry) => entry.nodeId));
  const initialLogs = failedRun.logs.filter(
    (log) => log.status === "completed" && completedIds.has(log.nodeId),
  );
  const runId = crypto.randomUUID();
  createWorkflowRun({
    runId,
    parentRunId: failedRun.runId,
    graph: failedRun.graph,
    input: failedRun.input,
    trace: completedTrace,
    logs: initialLogs,
  });

  try {
    await inngest.send({
      name: "workflow/run",
      data: {
        runId,
        graph: failedRun.graph,
        input: failedRun.input,
        startNodeId: retryNode.id,
        initialTrace: completedTrace,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to queue node retry.";
    updateWorkflowRun(runId, (run) => ({
      ...run,
      status: "failed",
      failedNodeId: retryNode.id,
      error: `Unable to queue node retry: ${message}`,
    }));
    return NextResponse.json(
      { error: `Unable to queue node retry: ${message}`, runId },
      { status: 503 },
    );
  }

  return NextResponse.json({ runId }, { status: 202 });
}

import { NextResponse } from "next/server";
import { inngest } from "@/inngest/client";
import { createWorkflowRun, updateWorkflowRun } from "@/lib/workflow-run-store";
import { WorkflowGraphSchema } from "@/lib/workflow-schemas";
import type { WorkflowGraph } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object" || !("graph" in body) || !("input" in body)) {
    return NextResponse.json(
      { error: "Provide a workflow graph and non-empty input." },
      { status: 400 },
    );
  }

  const graphResult = WorkflowGraphSchema.safeParse(body.graph);
  if (!graphResult.success) {
    return NextResponse.json(
      {
        error: "Workflow graph is invalid.",
        details: graphResult.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }
  if (typeof body.input !== "string" || !body.input.trim()) {
    return NextResponse.json(
      { error: "Provide a non-empty workflow input." },
      { status: 400 },
    );
  }

  const graph = graphResult.data as WorkflowGraph;
  const input = body.input.trim();
  const runId = crypto.randomUUID();
  createWorkflowRun({ runId, graph, input });

  try {
    await inngest.send({
      name: "workflow/run",
      data: { runId, graph, input },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to queue workflow run.";
    updateWorkflowRun(runId, (run) => ({
      ...run,
      status: "failed",
      error: message,
    }));
    return NextResponse.json(
      { error: `Unable to queue workflow run: ${message}`, runId },
      { status: 503 },
    );
  }

  return NextResponse.json({ runId }, { status: 202 });
}

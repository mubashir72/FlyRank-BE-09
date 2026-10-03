import { NextResponse } from "next/server";
import { getWorkflowRun } from "@/lib/workflow-run-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } },
) {
  const run = getWorkflowRun(params.runId);
  if (!run) {
    return NextResponse.json(
      { error: "Workflow run not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(run, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

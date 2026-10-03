import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { hello } from "@/inngest/functions";
import { runWorkflow } from "@/inngest/functions/run-workflow";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [hello, runWorkflow],
});

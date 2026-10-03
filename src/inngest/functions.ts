import { inngest } from "@/inngest/client";

export const hello = inngest.createFunction(
  { id: "hello", triggers: [{ event: "workflow/hello" }] },
  async ({ event }) => ({
    message: `Hello, ${event.data.name ?? "world"}!`,
  }),
);

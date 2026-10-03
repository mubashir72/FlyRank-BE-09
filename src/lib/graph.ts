import type { WorkflowGraph } from "@/lib/types";

export const DEFAULT_GRAPH: WorkflowGraph = {
  nodes: [
    {
      id: "decision-1",
      type: "decision",
      position: { x: 0, y: 0 },
      data: {
        title: "Is this a support request?",
        prompt:
          "Read the incoming message. Does the customer need help with an existing product or service?",
      },
    },
    {
      id: "support-2",
      type: "decision",
      position: { x: -270, y: 230 },
      data: {
        title: "Support Node",
        prompt: "Determine the right next step for this support request.",
      },
    },
    {
      id: "sales-3",
      type: "decision",
      position: { x: 270, y: 230 },
      data: {
        title: "Sales Node",
        prompt: "Determine the right next step for this sales inquiry.",
      },
    },
  ],
  edges: [
    {
      id: "decision-1-yes-support-2",
      source: "decision-1",
      sourceHandle: "yes",
      target: "support-2",
      targetHandle: "in",
      type: "yes",
      label: "YES",
      style: { stroke: "#18865b", strokeWidth: 2 },
    },
    {
      id: "decision-1-no-sales-3",
      source: "decision-1",
      sourceHandle: "no",
      target: "sales-3",
      targetHandle: "in",
      type: "no",
      label: "NO",
      style: { stroke: "#d34f52", strokeWidth: 2 },
    },
  ],
};

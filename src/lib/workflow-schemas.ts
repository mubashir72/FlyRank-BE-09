import { z } from "zod";

const DecisionNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("decision"),
    position: z.object({ x: z.number().finite(), y: z.number().finite() }),
    data: z.object({
      title: z.string(),
      prompt: z.string(),
    }),
  })
  .passthrough();

const WorkflowEdgeSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    sourceHandle: z.enum(["yes", "no"]),
    targetHandle: z.string().optional(),
    type: z.enum(["yes", "no"]),
  })
  .passthrough();

export const WorkflowGraphSchema = z
  .object({
    nodes: z.array(DecisionNodeSchema).min(1),
    edges: z.array(WorkflowEdgeSchema),
  })
  .superRefine((graph, context) => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    if (nodeIds.size !== graph.nodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Node IDs must be unique.",
      });
    }

    graph.edges.forEach((edge, index) => {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", index],
          message: "Every edge must connect existing nodes.",
        });
      }
      if (edge.sourceHandle !== edge.type) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", index, "sourceHandle"],
          message: "An edge type must match its YES/NO source handle.",
        });
      }
    });

    const sources = new Set<string>();
    graph.edges.forEach((edge) => {
      const branch = `${edge.source}:${edge.sourceHandle}`;
      if (sources.has(branch)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges"],
          message: `Node "${edge.source}" has more than one ${edge.sourceHandle.toUpperCase()} edge.`,
        });
      }
      sources.add(branch);
    });
  });

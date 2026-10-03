"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { DecisionNode } from "@/lib/types";

function DecisionNodeView({ data, selected }: NodeProps<DecisionNode>) {
  const executionStatus = data.executionStatus ?? "idle";
  return (
    <div
      className={`decision-node decision-node-${executionStatus}${selected ? " is-selected" : ""}`}
    >
      <Handle
        className="decision-handle decision-handle-target"
        type="target"
        position={Position.Top}
        id="in"
        aria-label="Incoming connection"
      />
      <div className="decision-node-heading">
        <div className="decision-node-icon" aria-hidden="true">
          ✦
        </div>
        <Badge variant="outline" className="decision-badge">
          AI DECISION
        </Badge>
        {data.executionOrder && (
          <span className="decision-order">{data.executionOrder}</span>
        )}
        <span className="decision-node-menu" aria-hidden="true">
          •••
        </span>
      </div>
      <div className="decision-node-copy">
        <h3>{data.title || "Untitled decision"}</h3>
        <p>{data.prompt || "Add a prompt to define this decision."}</p>
      </div>
      <div className="decision-node-footer">
        <span className="output-label output-label-yes">YES</span>
        <span className="output-label output-label-no">NO</span>
        {data.executionAnswer && (
          <Badge
            className={`decision-answer decision-answer-${data.executionAnswer.toLowerCase()}`}
          >
            {data.executionAnswer}
          </Badge>
        )}
      </div>
      <Handle
        className="decision-handle decision-handle-yes"
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: "25%" }}
        aria-label="YES output"
      />
      <Handle
        className="decision-handle decision-handle-no"
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: "75%" }}
        aria-label="NO output"
      />
    </div>
  );
}

export const DecisionNodeViewMemo = memo(DecisionNodeView);

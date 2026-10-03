"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

type BranchEdgeProps = EdgeProps & {
  branch: "YES" | "NO";
  color: string;
  className?: string;
};

export function BranchEdge({ branch, color, ...props }: BranchEdgeProps) {
  const [path, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={props.markerEnd}
        className={props.className}
        style={{ ...props.style, stroke: color, strokeWidth: 2 }}
      />
      <EdgeLabelRenderer>
        <div
          className={`branch-edge-label branch-edge-label-${branch.toLowerCase()} nodrag nopan`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {branch}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export function YesEdge(props: EdgeProps) {
  return <BranchEdge {...props} branch="YES" color="#18865b" />;
}

export function NoEdge(props: EdgeProps) {
  return <BranchEdge {...props} branch="NO" color="#d34f52" />;
}

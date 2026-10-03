"use client";

import { Clock3, FolderOpen, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SavedWorkflow, WorkflowHistoryEntry } from "@/lib/types";

type WorkflowLibrarySheetProps = {
  open: boolean;
  name: string;
  workflows: SavedWorkflow[];
  history: WorkflowHistoryEntry[];
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onLoad: (workflow: SavedWorkflow) => void;
  onDelete: (workflow: SavedWorkflow) => void;
  onReplay: (run: WorkflowHistoryEntry) => void;
};

export function WorkflowLibrarySheet({
  open,
  name,
  workflows,
  history,
  onOpenChange,
  onNameChange,
  onSave,
  onLoad,
  onDelete,
  onReplay,
}: WorkflowLibrarySheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="library-sheet sm:max-w-lg">
        <SheetHeader className="library-header">
          <div className="library-title-icon">
            <FolderOpen size={18} />
          </div>
          <SheetTitle>Workflow library</SheetTitle>
          <SheetDescription>
            Save reusable graphs and revisit recent execution paths.
          </SheetDescription>
        </SheetHeader>

        <div className="library-section">
          <h3>Save current workflow</h3>
          <div className="library-save-row">
            <Input
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Workflow name"
              aria-label="Workflow name"
              onKeyDown={(event) => {
                if (event.key === "Enter") onSave();
              }}
            />
            <Button onClick={onSave} disabled={!name.trim()}>
              Save
            </Button>
          </div>
        </div>

        <div className="library-section library-scroll-section">
          <div className="library-section-heading">
            <h3>Saved workflows</h3>
            <Badge variant="outline">{workflows.length}</Badge>
          </div>
          {workflows.length === 0 ? (
            <p className="library-empty">No saved workflows yet.</p>
          ) : (
            <ul className="library-list">
              {workflows.map((workflow) => (
                <li className="library-list-item" key={workflow.id}>
                  <button
                    type="button"
                    className="library-item-main"
                    onClick={() => onLoad(workflow)}
                  >
                    <span className="library-item-title">{workflow.name}</span>
                    <span className="library-item-meta">
                      {workflow.graph.nodes.length} nodes · Updated{" "}
                      {new Date(workflow.updatedAt).toLocaleDateString()}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${workflow.name}`}
                    onClick={() => onDelete(workflow)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="library-section library-scroll-section">
          <div className="library-section-heading">
            <h3>
              <Clock3 size={14} />
              Recent runs
            </h3>
            <Badge variant="outline">{history.length} / 20</Badge>
          </div>
          {history.length === 0 ? (
            <p className="library-empty">Completed runs will appear here.</p>
          ) : (
            <ul className="library-list">
              {history.map((run) => (
                <li className="library-list-item" key={run.runId}>
                  <button
                    type="button"
                    className="library-item-main"
                    onClick={() => onReplay(run)}
                  >
                    <span className="library-item-title">
                      {run.input.length > 64
                        ? `${run.input.slice(0, 64)}...`
                        : run.input}
                    </span>
                    <span className="library-item-meta">
                      {new Date(run.startedAt).toLocaleString()} ·{" "}
                      {run.trace.length} steps
                    </span>
                  </button>
                  <span className={`run-status run-status-${run.status}`}>
                    {run.status}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Replay this run"
                    onClick={() => onReplay(run)}
                  >
                    <Play size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

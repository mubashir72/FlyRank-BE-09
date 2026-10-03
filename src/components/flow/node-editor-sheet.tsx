"use client";

import { AlertCircle, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import type { DecisionNodeData } from "@/lib/types";

type NodeEditorSheetProps = {
  open: boolean;
  title: string;
  prompt: string;
  onOpenChange: (open: boolean) => void;
  onChange: (data: DecisionNodeData) => void;
  onDelete: () => void;
};

export function NodeEditorSheet({
  open,
  title,
  prompt,
  onOpenChange,
  onChange,
  onDelete,
}: NodeEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="node-editor-sheet sm:max-w-md">
        <SheetHeader className="node-editor-header">
          <Badge variant="outline" className="decision-badge w-fit">
            AI DECISION
          </Badge>
          <SheetTitle>Edit decision</SheetTitle>
          <SheetDescription>
            Set the question this node should answer. It will resolve to YES or
            NO.
          </SheetDescription>
        </SheetHeader>

        <div className="node-editor-fields">
          <label className="editor-label" htmlFor="node-title">
            Node title
          </label>
          <Input
            id="node-title"
            value={title}
            onChange={(event) =>
              onChange({ title: event.target.value, prompt })
            }
            placeholder="e.g. Is this a support request?"
            autoFocus
          />

          <label className="editor-label" htmlFor="node-prompt">
            Decision prompt
          </label>
          <Textarea
            id="node-prompt"
            value={prompt}
            onChange={(event) =>
              onChange({ title, prompt: event.target.value })
            }
            placeholder="Describe how the AI should decide between YES and NO..."
            rows={7}
          />
          <div className="editor-hint">
            <AlertCircle size={15} />
            <span>Be specific about what qualifies as YES or NO.</span>
          </div>
        </div>

        <div className="node-editor-footer">
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 size={16} />
            Delete node
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

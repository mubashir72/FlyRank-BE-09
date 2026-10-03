"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Download,
  FileJson,
  FolderOpen,
  LoaderCircle,
  Moon,
  Play,
  Plus,
  Save,
  Sun,
  Workflow,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { DecisionNodeViewMemo } from "@/components/flow/decision-node";
import { NoEdge, YesEdge } from "@/components/flow/branch-edge";
import { NodeEditorSheet } from "@/components/flow/node-editor-sheet";
import { WorkflowLibrarySheet } from "@/components/flow/workflow-library-sheet";
import { Button } from "@/components/ui/button";
import { DEFAULT_GRAPH } from "@/lib/graph";
import { loadWorkflowGraph, saveWorkflowGraph } from "@/lib/storage";
import {
  deleteSavedWorkflow,
  loadRunHistory,
  loadSavedWorkflows,
  saveNamedWorkflow,
  saveRunHistoryEntry,
  toWorkflowGraph,
} from "@/lib/workflow-library";
import type {
  DecisionNode,
  DecisionNodeData,
  SavedWorkflow,
  WorkflowEdge,
  WorkflowHistoryEntry,
  WorkflowLogEntry,
  WorkflowRunState,
} from "@/lib/types";

const nodeTypes: NodeTypes = { decision: DecisionNodeViewMemo };
const edgeTypes: EdgeTypes = { yes: YesEdge, no: NoEdge };

function FlowCanvas() {
  const [nodes, setNodes] = useNodesState<DecisionNode>(DEFAULT_GRAPH.nodes);
  const [edges, setEdges] = useEdgesState<WorkflowEdge>(DEFAULT_GRAPH.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<WorkflowRunState | null>(null);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled workflow");
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [runHistory, setRunHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const logListRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { fitView, screenToFlowPosition } = useReactFlow<
    DecisionNode,
    WorkflowEdge
  >();

  useEffect(() => {
    const savedGraph = loadWorkflowGraph();
    if (savedGraph) {
      setNodes(savedGraph.nodes);
      setEdges(savedGraph.edges);
    }
    setSavedWorkflows(loadSavedWorkflows());
    setRunHistory(loadRunHistory());
    setIsDarkMode(window.localStorage.getItem("branch-theme") === "dark");
    setIsHydrated(true);
  }, [setEdges, setNodes]);

  useEffect(() => {
    if (!isHydrated) return;
    document.documentElement.classList.toggle("dark", isDarkMode);
    window.localStorage.setItem("branch-theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    saveWorkflowGraph({ nodes, edges });
  }, [edges, isHydrated, nodes]);

  useEffect(() => {
    if (!activeRunId) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const pollRun = async () => {
      try {
        const response = await fetch(`/api/runs/${activeRunId}`);
        const result = (await response.json()) as WorkflowRunState & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "Unable to retrieve workflow run.");
        }
        if (cancelled) return;

        setRunResult(result);
        try {
          setRunHistory(saveRunHistoryEntry(result));
        } catch (error) {
          console.error("Unable to save execution history.", error);
        }
        if (result.status === "completed" || result.status === "failed") {
          setActiveRunId(null);
          return;
        }
        timeout = setTimeout(pollRun, 1200);
      } catch (error) {
        if (cancelled) return;
        setRunError(
          error instanceof Error ? error.message : "Unable to poll workflow run.",
        );
        setActiveRunId(null);
      }
    };

    void pollRun();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [activeRunId]);

  useEffect(() => {
    if (!logsOpen || !logListRef.current) return;
    logListRef.current.scrollTop = logListRef.current.scrollHeight;
  }, [logsOpen, runResult?.logs]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  const onNodesChange = useCallback(
    (changes: NodeChange<DecisionNode>[]) =>
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes)),
    [setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowEdge>[]) =>
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges)),
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (
        !connection.source ||
        !connection.target ||
        (connection.sourceHandle !== "yes" &&
          connection.sourceHandle !== "no")
      ) {
        return;
      }

      const branch = connection.sourceHandle;
      const color = branch === "yes" ? "#18865b" : "#d34f52";
      setEdges((currentEdges) => {
        const branchAlreadyConnected = currentEdges.some(
          (edge) =>
            edge.source === connection.source &&
            edge.sourceHandle === branch,
        );
        if (branchAlreadyConnected) return currentEdges;

        return addEdge(
          {
            ...connection,
            id: `${connection.source}-${branch}-${connection.target}`,
            type: branch,
            label: branch.toUpperCase(),
            style: { stroke: color, strokeWidth: 2 },
          },
          currentEdges,
        );
      });
    },
    [setEdges],
  );

  const addNode = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    const offset = nodes.length * 24;
    const position = screenToFlowPosition({
      x: bounds.left + bounds.width / 2 + offset,
      y: bounds.top + bounds.height / 2 + offset,
    });
    const id = `decision-${crypto.randomUUID()}`;

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: "decision",
        position,
        data: {
          title: "New decision",
          prompt: "Describe the question this node should answer.",
        },
      },
    ]);
    setSelectedNodeId(id);
  }, [nodes.length, screenToFlowPosition, setNodes]);

  const startWorkflowRun = useCallback(async () => {
    if (!testInput.trim() || isStartingRun || activeRunId) return;
    setIsStartingRun(true);
    setRunError(null);
    setRunResult(null);
    setLogsOpen(true);

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graph: { nodes, edges }, input: testInput }),
      });
      const result = (await response.json()) as
        | { runId: string }
        | { error: string };
      if (!response.ok || !("runId" in result)) {
        throw new Error(
          "error" in result ? result.error : "Unable to start workflow.",
        );
      }

      setRunResult({
        runId: result.runId,
        graph: { nodes, edges },
        input: testInput.trim(),
        startedAt: new Date().toISOString(),
        status: "running",
        trace: [],
        logs: [],
        activeNodeId: null,
        failedNodeId: null,
        finalNode: null,
      });
      setActiveRunId(result.runId);
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : "Unable to start workflow.",
      );
    } finally {
      setIsStartingRun(false);
    }
  }, [activeRunId, edges, isStartingRun, nodes, testInput]);

  const updateSelectedNode = useCallback(
    (data: DecisionNodeData) => {
      if (!selectedNodeId) return;
      setNodes((currentNodes) =>
        currentNodes.map((node) =>
          node.id === selectedNodeId ? { ...node, data } : node,
        ),
      );
    },
    [selectedNodeId, setNodes],
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((currentNodes) =>
      currentNodes.filter((node) => node.id !== selectedNodeId),
    );
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) =>
          edge.source !== selectedNodeId && edge.target !== selectedNodeId,
      ),
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, setEdges, setNodes]);

  const decisionByNode = useMemo(
    () => new Map(runResult?.trace.map((entry) => [entry.nodeId, entry]) ?? []),
    [runResult?.trace],
  );
  const executionLogByNode = useMemo(
    () =>
      new Map(
        runResult?.logs.map((entry) => [entry.nodeId, entry]) ?? [],
      ),
    [runResult?.logs],
  );
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        const decision = decisionByNode.get(node.id);
        const log = executionLogByNode.get(node.id);
        const executionStatus: DecisionNodeData["executionStatus"] =
          runResult?.failedNodeId === node.id || log?.status === "failed"
            ? "failed"
            : runResult?.activeNodeId === node.id
              ? "running"
              : decision
                ? "completed"
                : "idle";
        return {
          ...node,
          data: {
            ...node.data,
            executionStatus,
            executionAnswer: decision?.answer,
            executionOrder: decision?.order,
          },
        };
      }),
    [decisionByNode, executionLogByNode, nodes, runResult],
  );
  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        const decision = decisionByNode.get(edge.source);
        const isTaken = Boolean(
          decision && edge.type === decision.answer.toLowerCase(),
        );
        const isActive = Boolean(
          isTaken &&
            runResult?.status === "running" &&
            runResult.activeNodeId === edge.target,
        );
        const className = [
          isActive ? "branch-edge-active" : "",
          isTaken && !isActive ? "branch-edge-completed" : "",
          decision && !isTaken ? "branch-edge-dimmed" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return {
          ...edge,
          animated: isActive,
          className,
        };
      }),
    [decisionByNode, edges, runResult],
  );

  const currentGraph = useCallback(
    () => ({ nodes, edges }),
    [edges, nodes],
  );

  const saveCurrentWorkflow = useCallback(() => {
    const name = workflowName.trim() || "Untitled workflow";
    try {
      setSavedWorkflows(saveNamedWorkflow(name, currentGraph()));
      setWorkflowName(name);
      toast.success(`Saved "${name}"`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save workflow.",
      );
    }
  }, [currentGraph, workflowName]);

  const loadWorkflow = useCallback(
    (workflow: SavedWorkflow) => {
      setNodes(workflow.graph.nodes);
      setEdges(workflow.graph.edges);
      setWorkflowName(workflow.name);
      setLibraryOpen(false);
      setRunResult(null);
      setRunError(null);
      toast.success(`Loaded "${workflow.name}"`);
    },
    [setEdges, setNodes],
  );

  const removeWorkflow = useCallback((workflow: SavedWorkflow) => {
    try {
      setSavedWorkflows(deleteSavedWorkflow(workflow.id));
      toast.success(`Deleted "${workflow.name}"`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to delete workflow.",
      );
    }
  }, []);

  const exportWorkflow = useCallback(() => {
    const blob = new Blob([JSON.stringify(currentGraph(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(workflowName || "workflow")
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Workflow JSON exported");
  }, [currentGraph, workflowName]);

  const importWorkflow = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        const imported = toWorkflowGraph(JSON.parse(await file.text()));
        setNodes(imported.nodes);
        setEdges(imported.edges);
        setWorkflowName(file.name.replace(/\.json$/i, ""));
        setRunResult(null);
        setRunError(null);
        toast.success("Workflow imported");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? `Import failed: ${error.message}`
            : "Import failed: invalid workflow JSON.",
        );
      } finally {
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [setEdges, setNodes],
  );

  const replayRun = useCallback(
    (run: WorkflowHistoryEntry) => {
      setActiveRunId(null);
      setRunResult(run);
      setRunError(null);
      setNodes(run.graph.nodes);
      setEdges(run.graph.edges);
      setTestInput(run.input);
      setLogsOpen(true);
      setLibraryOpen(false);
      window.setTimeout(() => {
        void fitView({ padding: 0.32, maxZoom: 1.2 });
      }, 0);
    },
    [fitView, setEdges, setNodes],
  );

  const retryFailedNode = useCallback(async () => {
    if (!runResult?.failedNodeId || isStartingRun || activeRunId) return;
    setIsStartingRun(true);
    setRunError(null);
    try {
      const response = await fetch(`/api/runs/${runResult.runId}/retry`, {
        method: "POST",
      });
      const result = (await response.json()) as
        | { runId: string }
        | { error: string };
      if (!response.ok || !("runId" in result)) {
        throw new Error(
          "error" in result ? result.error : "Unable to retry failed node.",
        );
      }
      setRunResult({
        ...runResult,
        runId: result.runId,
        startedAt: new Date().toISOString(),
        status: "running",
        logs: runResult.logs.filter((log) => log.status === "completed"),
        activeNodeId: runResult.failedNodeId,
        failedNodeId: null,
        error: undefined,
      });
      setActiveRunId(result.runId);
      setLogsOpen(true);
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : "Unable to retry failed node.",
      );
    } finally {
      setIsStartingRun(false);
    }
  }, [activeRunId, isStartingRun, runResult]);

  const defaultEdgeOptions = useMemo(
    () => ({ type: "yes" as const, interactionWidth: 24 }),
    [],
  );

  return (
    <main className="workflow-shell">
      <header className="workflow-toolbar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <Workflow size={19} strokeWidth={2.2} />
          </div>
          <div>
            <p className="brand-name">branch</p>
            <p className="brand-subtitle">AI workflow studio</p>
          </div>
        </div>
        <div className="toolbar-divider" />
        <div className="workflow-title-group">
          <span className="workflow-title">{workflowName}</span>
          <span className="workflow-status">
            <Check size={13} />
            Saved locally
          </span>
        </div>
        <div className="toolbar-actions">
          <Button
            variant="ghost"
            size="sm"
            className="toolbar-utility-button"
            onClick={saveCurrentWorkflow}
          >
            <Save size={15} />
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="toolbar-utility-button"
            aria-label="Open workflow library and execution history"
            title="Workflow library and history"
            onClick={() => {
              setWorkflowNameDraft(workflowName);
              setLibraryOpen(true);
            }}
          >
            <FolderOpen size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="toolbar-utility-button"
            aria-label="Export workflow JSON"
            title="Export JSON"
            onClick={exportWorkflow}
          >
            <Download size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="toolbar-utility-button"
            aria-label="Import workflow JSON"
            title="Import JSON"
            onClick={() => importInputRef.current?.click()}
          >
            <FileJson size={16} />
          </Button>
          <input
            ref={importInputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            aria-label="Import workflow JSON file"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => void importWorkflow(event.target.files?.[0])}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="toolbar-utility-button theme-toggle"
            aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            title={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
            onClick={() => setIsDarkMode((mode) => !mode)}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
          <Button className="add-node-button" onClick={addNode}>
            <Plus size={16} strokeWidth={2.5} />
            Add node
          </Button>
        </div>
      </header>

      <div className="execution-toolbar">
        <div className="execution-input-wrap">
          <label className="sr-only" htmlFor="workflow-test-input">
            Test input
          </label>
          <input
            id="workflow-test-input"
            className="execution-input"
            value={testInput}
            onChange={(event) => setTestInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void startWorkflowRun();
            }}
            placeholder="Enter a message to test this workflow..."
          />
        </div>
        <Button
          className="run-workflow-button"
          onClick={() => void startWorkflowRun()}
          disabled={!testInput.trim() || isStartingRun || Boolean(activeRunId)}
        >
          {isStartingRun || activeRunId ? (
            <LoaderCircle className="animate-spin" size={15} />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          {isStartingRun || activeRunId ? "Running..." : "Run workflow"}
        </Button>
        {runResult && (
          <Button
            variant="ghost"
            size="sm"
            className={`logs-toggle${logsOpen ? " is-open" : ""}`}
            onClick={() => setLogsOpen((open) => !open)}
            aria-expanded={logsOpen}
          >
            {logsOpen ? "Hide logs" : "Execution logs"}
            {runResult.logs.length > 0 && (
              <span className="logs-count">{runResult.logs.length}</span>
            )}
          </Button>
        )}
        <span className="execution-hint">Test input · AI decisions</span>
      </div>

      <section className="flow-stage" ref={stageRef} aria-label="Workflow editor">
        <div className="canvas-caption">
          <span className="canvas-caption-dot" />
          Decision flow
        </div>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.32, maxZoom: 1.2 }}
          minZoom={0.25}
          maxZoom={1.5}
          className="workflow-canvas"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.2}
            color="#cbd5e1"
          />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => {
              const status = node.data.executionStatus;
              if (status === "running") return "#7794f4";
              if (status === "completed") return "#66b58c";
              if (status === "failed") return "#e47777";
              return "#cbd5e1";
            }}
            maskColor="rgba(244, 247, 251, 0.72)"
            className="workflow-minimap"
            pannable
            zoomable
          />
        </ReactFlow>
        {(runResult || runError) && (
          <aside className="run-results" aria-live="polite">
            <div className="run-results-heading">
              <div>
                <p className="run-results-eyebrow">EXECUTION</p>
                <h2>Workflow trace</h2>
              </div>
              {runResult && (
                <span className={`run-status run-status-${runResult.status}`}>
                  {runResult.status}
                </span>
              )}
            </div>
            {runResult?.status === "failed" && runResult.failedNodeId && (
              <Button
                className="retry-node-button"
                size="sm"
                onClick={() => void retryFailedNode()}
                disabled={isStartingRun || Boolean(activeRunId)}
              >
                <Play size={13} fill="currentColor" />
                Retry failed node
              </Button>
            )}
            {runError && (
              <p className="run-error">
                <CircleAlert size={14} />
                {runError}
              </p>
            )}
            {runResult?.error && (
              <p className="run-error">
                <CircleAlert size={14} />
                {runResult.error}
              </p>
            )}
            {runResult && runResult.trace.length > 0 && (
              <ol className="run-trace">
                {runResult.trace.map((entry) => (
                  <li className="run-trace-entry" key={entry.order}>
                    <span className="run-trace-order">{entry.order}</span>
                    <div className="run-trace-copy">
                      <span className="run-trace-title">{entry.title}</span>
                      <span className="run-trace-time">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <span
                      className={`run-answer run-answer-${entry.answer.toLowerCase()}`}
                    >
                      {entry.answer}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {runResult?.status === "completed" && runResult.finalNode && (
              <p className="run-final-node">
                Terminal node: <strong>{runResult.finalNode.title}</strong>
              </p>
            )}
          </aside>
        )}
        {runResult && (
          <section
            className={`execution-logs-panel${logsOpen ? " is-expanded" : ""}`}
            aria-label="Execution logs"
          >
            <button
              type="button"
              className="execution-logs-heading"
              onClick={() => setLogsOpen((open) => !open)}
              aria-expanded={logsOpen}
            >
              <span>
                {logsOpen ? "−" : "+"} Execution logs
                <span className="logs-count">{runResult.logs.length}</span>
              </span>
              <span className="execution-logs-status">
                {runResult.status === "running" ? "Live" : runResult.status}
              </span>
            </button>
            {logsOpen && (
              <div className="execution-logs-list" ref={logListRef}>
                {runResult.logs.length === 0 ? (
                  <p className="logs-empty">Waiting for the first decision...</p>
                ) : (
                  runResult.logs.map((log, index) => (
                    <ExecutionLogItem key={`${log.nodeId}-${index}`} log={log} />
                  ))
                )}
              </div>
            )}
          </section>
        )}
      </section>

      <NodeEditorSheet
        open={Boolean(selectedNode)}
        title={selectedNode?.data.title ?? ""}
        prompt={selectedNode?.data.prompt ?? ""}
        onOpenChange={(open) => {
          if (!open) setSelectedNodeId(null);
        }}
        onChange={updateSelectedNode}
        onDelete={deleteSelectedNode}
      />
      <WorkflowLibrarySheet
        open={libraryOpen}
        name={workflowNameDraft}
        workflows={savedWorkflows}
        history={runHistory}
        onOpenChange={setLibraryOpen}
        onNameChange={setWorkflowNameDraft}
        onSave={() => {
          if (!workflowNameDraft.trim()) return;
          try {
            setSavedWorkflows(saveNamedWorkflow(workflowNameDraft, currentGraph()));
            setWorkflowName(workflowNameDraft.trim());
            toast.success(`Saved "${workflowNameDraft.trim()}"`);
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Unable to save workflow.",
            );
          }
        }}
        onLoad={loadWorkflow}
        onDelete={removeWorkflow}
        onReplay={replayRun}
      />
      <Toaster position="bottom-center" richColors closeButton />
    </main>
  );
}

function ExecutionLogItem({ log }: { log: WorkflowLogEntry }) {
  return (
    <article className={`execution-log-item execution-log-${log.status}`}>
      <div className="execution-log-topline">
        <span className="execution-log-time">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <span className="execution-log-title">
          {log.order}. {log.title}
        </span>
        <span className={`run-status run-status-${log.status}`}>
          {log.status === "completed" && log.answer
            ? log.answer
            : log.status}
        </span>
      </div>
      <p className="execution-log-prompt">{log.prompt}</p>
      {typeof log.durationMs === "number" && (
        <span className="execution-log-duration">
          {log.durationMs.toLocaleString()} ms
        </span>
      )}
      {log.error && <p className="execution-log-error">{log.error}</p>}
    </article>
  );
}

export function FlowEditor() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}

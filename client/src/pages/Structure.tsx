import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStructureLayout } from "@/hooks/useStructureLayout";
import { createStructureElement } from "@/lib/structureFactory";
import type { EditorToolId } from "@/lib/structureEditorTools";
import { getEditorTool } from "@/lib/structureEditorTools";
import type { StructureElementType } from "@/types/structure";
import StructureHeader from "@/components/structure/StructureHeader";
import StructureEditorToolbar from "@/components/structure/StructureEditorToolbar";
import { motion, pageContainerVariants, pageItemVariants } from "@/lib/motionVariants";
import { STRUCTURE_GRID_SIZE } from "@/lib/structureConstants";
import { clampElementBounds, clampMovePosition } from "@/lib/structureElementBounds";
import type { StructureElement } from "@/types/structure";
import StructureEditorSidebar from "@/components/structure/StructureEditorSidebar";
import StructureCanvas from "@/components/structure/StructureCanvas";
import ElementEditorDialog from "@/components/structure/ElementEditorDialog";

export default function Structure() {
  const {
    layout,
    canUndo,
    canRedo,
    addElement,
    updateElement,
    removeElement,
    undo,
    redo,
    saveNow,
    pushUndoSnapshot,
  } = useStructureLayout();

  const [defaultSector] = useState("Geral");
  const [defaultTeam] = useState("Equipe A");
  const [activeTool, setActiveTool] = useState<EditorToolId>("select");
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [elementDialogOpen, setElementDialogOpen] = useState(false);
  const moveSnapshotRef = useRef(structuredClone(layout));
  const resizeSnapshotRef = useRef(structuredClone(layout));

  useEffect(() => {
    document.documentElement.classList.add("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  const selectedElement = layout.elements.find((el) => el.id === selectedId) ?? null;

  const handleSelectElement = (id: string | null) => {
    setSelectedId(id);
    if (!id) setElementDialogOpen(false);
  };

  const handleEditElement = (id: string) => {
    setSelectedId(id);
    setElementDialogOpen(true);
  };

  const handleRemoveElement = useCallback(
    (id: string) => {
      const removed = layout.elements.find((el) => el.id === id);
      removeElement(id);
      setSelectedId((current) => {
        if (current === id) return null;
        return current;
      });
      setElementDialogOpen(false);
      if (removed) toast.success(`${removed.label} removido`);
    },
    [layout.elements, removeElement]
  );

  /** Cria uma cópia (com mesas novas e vagas livres, sem repetir atendentes) deslocada do original */
  const cloneElement = useCallback(
    (source: StructureElement, offset: number) => {
      const copy = createStructureElement(source.type, {
        roomKind: source.roomKind,
        sector: source.sector,
        team: source.team,
        textContent: source.textContent,
        x: source.x + offset,
        y: source.y + offset,
      });
      const bounds = clampElementBounds(copy, {
        x: source.x + offset,
        y: source.y + offset,
        width: source.width,
        height: source.height,
      });
      return {
        ...copy,
        ...bounds,
        rotation: source.rotation,
        zIndex: source.zIndex,
        ...(source.type === "text" || source.type === "area" || source.type === "sector"
          ? { label: source.label }
          : null),
      } satisfies StructureElement;
    },
    []
  );

  const clipboardRef = useRef<{ element: StructureElement; pastes: number } | null>(null);

  const handleDuplicate = useCallback(() => {
    if (!selectedElement) return;
    const copy = cloneElement(selectedElement, STRUCTURE_GRID_SIZE);
    addElement(copy);
    setSelectedId(copy.id);
    toast.success(`${copy.label} duplicado`);
  }, [selectedElement, cloneElement, addElement]);

  const handleCopy = useCallback(() => {
    if (!selectedElement) return;
    clipboardRef.current = { element: selectedElement, pastes: 0 };
    toast.success(`${selectedElement.label} copiado`);
  }, [selectedElement]);

  const handlePaste = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip) return;
    clip.pastes += 1;
    const copy = cloneElement(clip.element, STRUCTURE_GRID_SIZE * clip.pastes);
    addElement(copy);
    setSelectedId(copy.id);
  }, [cloneElement, addElement]);

  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      if (!selectedElement) return;
      const next = clampMovePosition(selectedElement, selectedElement.x + dx, selectedElement.y + dy);
      updateElement(selectedElement.id, next);
    },
    [selectedElement, updateElement]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")
      ) {
        return;
      }

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        setSelectedId(null);
        setActiveTool("select");
        return;
      }

      if (mod && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (activeTool !== "select" || !selectedId) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        handleRemoveElement(selectedId);
      } else if (mod && key === "c") {
        event.preventDefault();
        handleCopy();
      } else if (mod && key === "d") {
        event.preventDefault();
        handleDuplicate();
      } else if (event.key.startsWith("Arrow") && !mod) {
        event.preventDefault();
        const step = event.shiftKey ? STRUCTURE_GRID_SIZE : snapEnabled ? STRUCTURE_GRID_SIZE : 1;
        if (event.key === "ArrowLeft") handleNudge(-step, 0);
        if (event.key === "ArrowRight") handleNudge(step, 0);
        if (event.key === "ArrowUp") handleNudge(0, -step);
        if (event.key === "ArrowDown") handleNudge(0, step);
      }
    };

    // Colar funciona mesmo sem seleção (cola o último elemento copiado)
    const onPaste = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        handlePaste();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onPaste);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onPaste);
    };
  }, [
    selectedId,
    activeTool,
    snapEnabled,
    handleRemoveElement,
    handleCopy,
    handlePaste,
    handleDuplicate,
    handleNudge,
    undo,
    redo,
  ]);

  const handleAddElement = (type: StructureElementType) => {
    const element = createStructureElement(type, {
      sector: defaultSector,
      team: defaultTeam,
      placementIndex: layout.elements.length,
    });
    addElement(element);
    setSelectedId(element.id);
    setActiveTool("select");
    toast.success(`${element.label} adicionado`);
  };

  const handleAddAt = (element: Parameters<typeof addElement>[0]) => {
    addElement(element);
    setSelectedId(element.id);
    setActiveTool("select");
    toast.success(`${element.label} adicionado`);
  };

  const handleToolChange = (tool: EditorToolId) => {
    setActiveTool(tool);
    const toolDef = getEditorTool(tool);
    if (toolDef.elementType) {
      handleAddElement(toolDef.elementType);
    }
  };

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col gap-2 overflow-hidden"
      variants={pageContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={pageItemVariants}>
        <StructureHeader onSave={saveNow} onAddElement={handleAddElement} />
      </motion.div>

      <motion.div variants={pageItemVariants}>
      <StructureEditorToolbar
        activeTool={activeTool}
        zoom={zoom}
        canUndo={canUndo}
        canRedo={canRedo}
        onToolChange={handleToolChange}
        onZoomChange={setZoom}
        onDuplicate={handleDuplicate}
        onRotate90={() => {
          if (selectedElement) {
            updateElement(selectedElement.id, {
              rotation: (((selectedElement.rotation ?? 0) + 90) % 360),
            });
          }
        }}
        showGrid={showGrid}
        snapToGrid={snapEnabled}
        onShowGridChange={setShowGrid}
        onSnapToGridChange={setSnapEnabled}
        onUndo={undo}
        onRedo={redo}
        canDelete={selectedId != null}
        onDelete={() => {
          if (selectedId) handleRemoveElement(selectedId);
        }}
      />
      </motion.div>

      <motion.div
        variants={pageItemVariants}
        className="flex min-h-0 flex-1 overflow-hidden rounded-lg lumo-panel"
      >
        <StructureEditorSidebar
          elements={layout.elements}
          selectedId={selectedId}
          onSelect={(id) => handleSelectElement(id)}
          onAddElement={handleAddElement}
          onRemove={handleRemoveElement}
          onEdit={(id) => handleEditElement(id)}
        />

        <StructureCanvas
          elements={layout.elements}
          selectedId={selectedId}
          activeTool={activeTool}
          zoom={zoom}
          showGrid={showGrid}
          snapEnabled={snapEnabled}
          defaultSector={defaultSector}
          defaultTeam={defaultTeam}
          layoutSnapshot={layout}
          onSelect={handleSelectElement}
          onMove={(id, x, y, live) => updateElement(id, { x, y }, live)}
          onMoveStart={(snapshot) => {
            moveSnapshotRef.current = structuredClone(snapshot);
          }}
          onMoveEnd={() => pushUndoSnapshot(moveSnapshotRef.current)}
          onResize={(id, patch, live) => updateElement(id, patch, live)}
          onResizeStart={(snapshot) => {
            resizeSnapshotRef.current = structuredClone(snapshot);
          }}
          onResizeEnd={() => pushUndoSnapshot(resizeSnapshotRef.current)}
          onEditElement={handleEditElement}
          onRemoveElement={handleRemoveElement}
          onAddAt={handleAddAt}
          onRotate={(id, rotation, live) => updateElement(id, { rotation }, live)}
          onDrawWall={(wall) => {
            addElement(wall);
            setSelectedId(wall.id);
          }}
        />
      </motion.div>

      <ElementEditorDialog
        open={elementDialogOpen}
        onOpenChange={setElementDialogOpen}
        element={selectedElement}
        onSave={(patch) => {
          if (selectedId) updateElement(selectedId, patch);
        }}
        onRemove={() => {
          if (selectedId) handleRemoveElement(selectedId);
        }}
      />
    </motion.div>
  );
}

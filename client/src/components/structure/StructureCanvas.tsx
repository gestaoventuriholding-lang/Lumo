import { useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import type {
  StructureElement,
  StructureElementType,
} from "@/types/structure";
import type { StructureLayout } from "@/types/structure";
import {
  STRUCTURE_CANVAS_HEIGHT,
  STRUCTURE_CANVAS_WIDTH,
  STRUCTURE_GRID_SIZE,
  snapToGrid,
} from "@/lib/structureConstants";
import { createStructureElement } from "@/lib/structureFactory";
import { DRAG_MIME, parseDragPayload } from "@/lib/structureDrag";
import type { EditorToolId } from "@/lib/structureEditorTools";
import {
  applyResizeDelta,
  clampElementBounds,
  clampMovePosition,
  type ResizeHandle,
} from "@/lib/structureElementBounds";
import StructureElementNode from "./StructureElementNode";

interface StructureCanvasProps {
  elements: StructureElement[];
  selectedId: string | null;
  activeTool: EditorToolId;
  zoom: number;
  showGrid: boolean;
  snapEnabled: boolean;
  defaultSector: string;
  defaultTeam: string;
  layoutSnapshot: StructureLayout;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number, live?: boolean) => void;
  onMoveStart: (snapshot: StructureLayout) => void;
  onMoveEnd: () => void;
  onResize: (
    id: string,
    patch: Pick<StructureElement, "x" | "y" | "width" | "height">,
    live?: boolean
  ) => void;
  onResizeStart: (snapshot: StructureLayout) => void;
  onResizeEnd: () => void;
  onEditElement: (id: string) => void;
  onRemoveElement: (id: string) => void;
  onAddAt: (element: StructureElement) => void;
}

export default function StructureCanvas({
  elements,
  selectedId,
  activeTool,
  zoom,
  showGrid,
  snapEnabled,
  defaultSector,
  defaultTeam,
  layoutSnapshot,
  onSelect,
  onMove,
  onMoveStart,
  onMoveEnd,
  onResize,
  onResizeStart,
  onResizeEnd,
  onEditElement,
  onRemoveElement,
  onAddAt,
}: StructureCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState({ x: 1, y: 1 });
  const [isDragOver, setIsDragOver] = useState(false);
  const movedRef = useRef(false);
  const resizedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateFit = () => {
      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setCanvasScale({
        x: width / STRUCTURE_CANVAS_WIDTH,
        y: height / STRUCTURE_CANVAS_HEIGHT,
      });
    };

    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const snap = (value: number) => (snapEnabled ? snapToGrid(value) : value);
  const effectiveZoomX = canvasScale.x * zoom;
  const effectiveZoomY = canvasScale.y * zoom;

  const startDrag = (element: StructureElement, event: React.MouseEvent) => {
    if (activeTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    movedRef.current = false;
    onMoveStart(layoutSnapshot);

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = element.x;
    const originY = element.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / effectiveZoomX;
      const dy = (moveEvent.clientY - startY) / effectiveZoomY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) movedRef.current = true;
      const next = clampMovePosition(element, snap(originX + dx), snap(originY + dy));
      onMove(element.id, next.x, next.y, true);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (movedRef.current) onMoveEnd();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const startResize = (
    element: StructureElement,
    handle: ResizeHandle,
    event: React.MouseEvent
  ) => {
    if (activeTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    resizedRef.current = false;
    onResizeStart(layoutSnapshot);

    const startX = event.clientX;
    const startY = event.clientY;
    const origin = {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / effectiveZoomX;
      const dy = (moveEvent.clientY - startY) / effectiveZoomY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) resizedRef.current = true;
      const raw = applyResizeDelta(element, handle, dx, dy, origin);
      const bounds = snapEnabled
        ? clampElementBounds(element, {
            x: snapToGrid(raw.x),
            y: snapToGrid(raw.y),
            width: snapToGrid(raw.width),
            height: snapToGrid(raw.height),
          })
        : raw;
      onResize(element.id, bounds, true);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      if (resizedRef.current) onResizeEnd();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    const raw = event.dataTransfer.getData(DRAG_MIME);
    const payload = parseDragPayload(raw);
    if (!payload || !workspaceRef.current) return;

    const rect = workspaceRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / effectiveZoomX;
    const y = (event.clientY - rect.top) / effectiveZoomY;

    const element = createStructureElement(payload.type as StructureElementType, {
      sector: defaultSector,
      team: defaultTeam,
      label: payload.label,
      placementIndex: elements.length,
      x: Math.max(12, snap(x - 70)),
      y: Math.max(12, snap(y - 50)),
    });

    onAddAt(element);
  };

  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className={`relative min-h-0 flex-1 overflow-hidden bg-card transition-colors ${
        isDragOver ? "bg-blue-500/[0.03]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => onSelect(null)}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 border-2 border-dashed border-blue-400/40" />
      )}

      <div
        ref={workspaceRef}
        className="absolute inset-0 origin-top-left"
        style={{
          width: STRUCTURE_CANVAS_WIDTH,
          height: STRUCTURE_CANVAS_HEIGHT,
          ...(showGrid
            ? {
                backgroundImage:
                  "linear-gradient(to right, color-mix(in srgb, var(--border) 45%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--border) 45%, transparent) 1px, transparent 1px)",
                backgroundSize: `${STRUCTURE_GRID_SIZE}px ${STRUCTURE_GRID_SIZE}px`,
              }
            : null),
          transform: `scale(${effectiveZoomX}, ${effectiveZoomY})`,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        {sorted.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex flex-col items-center justify-center p-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
              <LayoutGrid className="h-6 w-6 text-blue-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">Layout vazio</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Arraste elementos do painel esquerdo ou use &quot;Novo elemento&quot; para começar
            </p>
          </div>
        ) : (
          sorted.map((element) => (
            <StructureElementNode
              key={element.id}
              element={element}
              selected={selectedId === element.id}
              editMode={activeTool === "select"}
              onSelect={() => onSelect(element.id)}
              onEdit={() => onEditElement(element.id)}
              onRemove={() => onRemoveElement(element.id)}
              onDragStart={(e) => startDrag(element, e)}
              onResizeStart={(handle, e) => startResize(element, handle, e)}
            />
          ))
        )}
      </div>
    </div>
  );
}

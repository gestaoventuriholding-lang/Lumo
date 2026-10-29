import type { ReactNode } from "react";
import type { StructureElement } from "@/types/structure";
import type { ResizeHandle } from "@/lib/structureElementBounds";
import { GripHorizontal, RotateCw, Trash2 } from "lucide-react";
import { structureSelectionRing } from "@/lib/structureVisualStyles";
import { cn } from "@/lib/utils";

const HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_CLASS: Record<ResizeHandle, string> = {
  nw: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  n: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  ne: "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  e: "top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  w: "top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
};

interface StructureElementFrameProps {
  element: StructureElement;
  selected: boolean;
  editMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDragStart: (event: React.MouseEvent) => void;
  onResizeStart: (handle: ResizeHandle, event: React.MouseEvent) => void;
  onRotateStart: (event: React.MouseEvent) => void;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export default function StructureElementFrame({
  element,
  selected,
  editMode,
  onSelect,
  onEdit,
  onRemove,
  onDragStart,
  onResizeStart,
  onRotateStart,
  className,
  contentClassName,
  children,
}: StructureElementFrameProps) {
  return (
    <div
      className={cn("absolute group/element", className)}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      {editMode && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-20 flex h-4 items-center justify-between rounded-t-[inherit] border-b border-border/50 bg-card/95 px-0.5 shadow-sm",
            selected ? "opacity-100" : "opacity-0 group-hover/element:opacity-100"
          )}
        >
          <div
            className="flex flex-1 cursor-grab items-center justify-center active:cursor-grabbing"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragStart(e);
            }}
            onClick={(e) => e.stopPropagation()}
            title="Arrastar elemento"
          >
            <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground" />
          </div>
          {selected && (
            <button
              type="button"
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="Excluir elemento"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      )}

      <div
        className={cn(
          "relative h-full w-full",
          selected && editMode && structureSelectionRing,
          contentClassName
        )}
      >
        {children}
      </div>

      {selected && editMode && (
        <button
          type="button"
          aria-label="Girar elemento"
          title="Arraste para girar"
          className="absolute -top-9 left-1/2 z-30 flex h-6 w-6 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm active:cursor-grabbing"
          onMouseDown={(e) => {
            e.stopPropagation();
            onRotateStart(e);
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <RotateCw className="h-3 w-3" />
        </button>
      )}

      {selected && editMode &&
        HANDLES.map((handle) => (
          <button
            key={handle}
            type="button"
            aria-label={`Redimensionar ${handle}`}
            className={cn(
              "absolute z-30 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow-sm",
              HANDLE_CLASS[handle]
            )}
            onMouseDown={(e) => {
              e.stopPropagation();
              onResizeStart(handle, e);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ))}
    </div>
  );
}

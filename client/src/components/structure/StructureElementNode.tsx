import { Image as ImageIcon, Monitor, Printer } from "lucide-react";
import type { StructureElement } from "@/types/structure";
import { ROOM_LABELS } from "@/lib/structureFactory";
import type { ResizeHandle } from "@/lib/structureElementBounds";
import {
  structureDeskFrame,
  structureRoomFrame,
  structureSectorFrame,
} from "@/lib/structureVisualStyles";
import StructureElementFrame from "./StructureElementFrame";

interface StructureElementNodeProps {
  element: StructureElement;
  selected: boolean;
  editMode: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDragStart: (event: React.MouseEvent) => void;
  onRemove: () => void;
  onResizeStart: (handle: ResizeHandle, event: React.MouseEvent) => void;
  onRotateStart: (event: React.MouseEvent) => void;
}

function RoomContent({ element }: { element: StructureElement }) {
  const title =
    element.roomKind != null ? ROOM_LABELS[element.roomKind] : element.label;

  return (
    <>
      <p className="border-b border-border/40 px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-1 items-center justify-center p-2">
        <div className="h-[55%] w-[65%] rounded border border-border/40 bg-muted/20" />
      </div>
    </>
  );
}

function DeskVisual({ element }: { element: StructureElement }) {
  const segments =
    element.type === "desk-double"
      ? 2
      : element.type === "island"
        ? 4
        : 1;

  return (
    <div className={`flex h-full flex-col ${structureDeskFrame} p-2`}>
      <p className="mb-2 truncate text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {element.label}
      </p>
      <div
        className={`grid flex-1 gap-1.5 ${
          segments >= 4 ? "grid-cols-2 grid-rows-2" : segments === 2 ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        {Array.from({ length: segments }, (_, index) => (
          <div
            key={index}
            className="flex items-center justify-center rounded-lg border border-border/60 bg-white/90 shadow-sm"
          >
            <Monitor className="h-5 w-5 text-muted-foreground/45" />
          </div>
        ))}
      </div>
    </div>
  );
}

const DESK_TYPES = new Set(["desk-single", "desk-double", "workstation", "island"]);

export default function StructureElementNode({
  element,
  selected,
  editMode,
  onSelect,
  onEdit,
  onDragStart,
  onRemove,
  onResizeStart,
  onRotateStart,
}: StructureElementNodeProps) {
  const frameProps = {
    element,
    selected,
    editMode,
    onSelect,
    onEdit,
    onDragStart,
    onRemove,
    onResizeStart,
    onRotateStart,
  };

  if (element.type === "text") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="flex items-center justify-center rounded border border-border/60 bg-white px-2 text-sm font-medium shadow-sm"
      >
        {element.textContent ?? element.label}
      </StructureElementFrame>
    );
  }

  if (element.type === "image") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/60 bg-white/80"
      >
        <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
        <span className="text-xs text-muted-foreground">{element.label}</span>
      </StructureElementFrame>
    );
  }

  if (element.type === "area") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="rounded-lg border-2 border-dashed border-blue-300/70 bg-blue-50/30"
      >
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-blue-700/80">
          {element.label}
        </p>
      </StructureElementFrame>
    );
  }

  if (DESK_TYPES.has(element.type)) {
    return (
      <StructureElementFrame {...frameProps}>
        <DeskVisual element={element} />
      </StructureElementFrame>
    );
  }

  if (element.type === "printer") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="flex items-center justify-center rounded-lg border border-border/70 bg-white shadow-sm"
      >
        <Printer className="h-5 w-5 text-muted-foreground" />
      </StructureElementFrame>
    );
  }

  const roomTypes = new Set(["room", "reception", "bathroom", "kitchen"]);

  if (roomTypes.has(element.type)) {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName={`flex flex-col ${structureRoomFrame} bg-white/60`}
      >
        <RoomContent element={element} />
      </StructureElementFrame>
    );
  }

  if (element.type === "sector") {
    return (
      <StructureElementFrame {...frameProps} contentClassName={structureSectorFrame}>
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-blue-700/90">
          {element.label}
        </p>
      </StructureElementFrame>
    );
  }

  if (element.type === "partition" || element.type === "wall") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="rounded-sm bg-foreground/25"
      />
    );
  }

  if (element.type === "corridor") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="rounded border border-border/50 bg-muted/40"
      />
    );
  }

  if (element.type === "door") {
    return (
      <StructureElementFrame
        {...frameProps}
        contentClassName="rounded border-2 border-amber-500/40 bg-amber-50/80"
      />
    );
  }

  return (
    <StructureElementFrame
      {...frameProps}
      contentClassName="flex items-center justify-center rounded border border-border/60 bg-white text-xs font-medium"
    >
      {element.label}
    </StructureElementFrame>
  );
}

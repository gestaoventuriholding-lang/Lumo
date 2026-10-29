import {
  STRUCTURE_CANVAS_HEIGHT,
  STRUCTURE_CANVAS_WIDTH,
} from "@/lib/structureConstants";
import type { StructureElement } from "@/types/structure";

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const CANVAS_PADDING = 12;

function minSizeForType(type: StructureElement["type"]): { width: number; height: number } {
  if (type === "wall" || type === "partition") return { width: 20, height: 6 };
  if (type === "corridor") return { width: 60, height: 24 };
  if (type === "door") return { width: 32, height: 32 };
  if (type === "text") return { width: 48, height: 24 };
  return { width: 48, height: 40 };
}

export function clampElementBounds(
  element: StructureElement,
  patch: Partial<Pick<StructureElement, "x" | "y" | "width" | "height">>
): Pick<StructureElement, "x" | "y" | "width" | "height"> {
  const mins = minSizeForType(element.type);
  let x = patch.x ?? element.x;
  let y = patch.y ?? element.y;
  let width = patch.width ?? element.width;
  let height = patch.height ?? element.height;

  width = Math.max(mins.width, width);
  height = Math.max(mins.height, height);

  const maxWidth = STRUCTURE_CANVAS_WIDTH - CANVAS_PADDING * 2;
  const maxHeight = STRUCTURE_CANVAS_HEIGHT - CANVAS_PADDING * 2;
  width = Math.min(width, maxWidth);
  height = Math.min(height, maxHeight);

  x = Math.max(CANVAS_PADDING, Math.min(x, STRUCTURE_CANVAS_WIDTH - width - CANVAS_PADDING));
  y = Math.max(CANVAS_PADDING, Math.min(y, STRUCTURE_CANVAS_HEIGHT - height - CANVAS_PADDING));

  return { x, y, width, height };
}

export function applyResizeDelta(
  element: StructureElement,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  origin: Pick<StructureElement, "x" | "y" | "width" | "height">
): Pick<StructureElement, "x" | "y" | "width" | "height"> {
  let { x, y, width, height } = origin;

  if (handle.includes("e")) width += dx;
  if (handle.includes("w")) {
    width -= dx;
    x += dx;
  }
  if (handle.includes("s")) height += dy;
  if (handle.includes("n")) {
    height -= dy;
    y += dy;
  }

  return clampElementBounds(element, { x, y, width, height });
}

export function clampMovePosition(
  element: StructureElement,
  x: number,
  y: number
): { x: number; y: number } {
  const bounds = clampElementBounds(element, { x, y });
  return { x: bounds.x, y: bounds.y };
}

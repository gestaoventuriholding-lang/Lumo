import type { StructureElementType } from "@/types/structure";

export const DRAG_MIME = "application/ellos-structure-element";

export function serializeDragPayload(type: StructureElementType, label?: string): string {
  return JSON.stringify({ type, label });
}

export function parseDragPayload(raw: string): {
  type: StructureElementType;
  roomKind?: string;
  label?: string;
} | null {
  try {
    return JSON.parse(raw) as {
      type: StructureElementType;
      roomKind?: string;
      label?: string;
    };
  } catch {
    return null;
  }
}

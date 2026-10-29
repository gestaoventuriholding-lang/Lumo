export type PositionStatus = "occupied" | "vacant" | "blocked" | "unavailable";

export type StructureElementType =
  | "desk-single"
  | "desk-double"
  | "workstation"
  | "island"
  | "room"
  | "sector"
  | "partition"
  | "reception"
  | "bathroom"
  | "kitchen"
  | "corridor"
  | "wall"
  | "door"
  | "printer"
  | "text"
  | "image"
  | "area";

export type RoomKind = "meeting" | "supervision" | "directorship" | "hr";

export type StructureFilterMode = "all" | "sector" | "team" | "vacant" | "status";

export interface StructureSlot {
  id: string;
  attendantId: number | null;
  sector: string;
  status: PositionStatus;
  label?: string;
}

export interface StructureElement {
  id: string;
  type: StructureElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  sector: string;
  team?: string;
  roomKind?: RoomKind;
  slots: StructureSlot[];
  zIndex: number;
  textContent?: string;
  /** Giro em graus (sentido horário) em torno do centro do elemento */
  rotation?: number;
}

export interface StructureMovementLog {
  id: string;
  timestamp: string;
  message: string;
  actor: string;
}

export interface StructureLayout {
  elements: StructureElement[];
  history: StructureMovementLog[];
  updatedAt: string;
}

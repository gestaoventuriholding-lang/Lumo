import type { LucideIcon } from "lucide-react";
import {
  Bath,
  Building2,
  Coffee,
  DoorOpen,
  Image as ImageIcon,
  LayoutGrid,
  Minus,
  Monitor,
  MousePointer2,
  Printer,
  Square,
  Type,
  Users,
} from "lucide-react";
import type { StructureElementType } from "@/types/structure";
export type EditorToolId = "select" | "desk" | "text" | "image" | "area";

export interface EditorTool {
  id: EditorToolId;
  label: string;
  icon: LucideIcon;
  elementType?: StructureElementType;
}

export const EDITOR_TOOLS: EditorTool[] = [
  { id: "select", label: "Seleção", icon: MousePointer2 },
  { id: "desk", label: "Mesa", icon: Monitor, elementType: "desk-single" },
  { id: "text", label: "Texto", icon: Type, elementType: "text" },
  { id: "image", label: "Imagem", icon: ImageIcon, elementType: "image" },
  { id: "area", label: "Área", icon: LayoutGrid, elementType: "area" },
];

export type PaletteGroup = "Mesas e postos" | "Ambientes" | "Construção" | "Equipamentos" | "Anotações";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  icon: LucideIcon;
  elementType: StructureElementType;
}

export const STRUCTURE_PALETTE: PaletteItem[] = [
  { id: "desk-single", group: "Mesas e postos", label: "Mesa", elementType: "desk-single", icon: Monitor },
  { id: "desk-double", group: "Mesas e postos", label: "Mesa dupla", elementType: "desk-double", icon: Monitor },
  { id: "workstation", group: "Mesas e postos", label: "Estação", elementType: "workstation", icon: Monitor },
  { id: "island", group: "Mesas e postos", label: "Ilha", elementType: "island", icon: Users },
  { id: "sector", group: "Ambientes", label: "Setor", elementType: "sector", icon: Building2 },
  { id: "room", group: "Ambientes", label: "Sala", elementType: "room", icon: Square },
  { id: "reception", group: "Ambientes", label: "Recepção", elementType: "reception", icon: Building2 },
  { id: "corridor", group: "Ambientes", label: "Corredor", elementType: "corridor", icon: Minus },
  { id: "wall", group: "Construção", label: "Parede", elementType: "wall", icon: Minus },
  { id: "door", group: "Construção", label: "Porta", elementType: "door", icon: DoorOpen },
  { id: "printer", group: "Equipamentos", label: "Impressora", elementType: "printer", icon: Printer },
  { id: "bathroom", group: "Ambientes", label: "Banheiro", elementType: "bathroom", icon: Bath },
  { id: "kitchen", group: "Ambientes", label: "Copa", elementType: "kitchen", icon: Coffee },
  { id: "text", group: "Anotações", label: "Texto", elementType: "text", icon: Type },
  { id: "image", group: "Anotações", label: "Imagem", elementType: "image", icon: ImageIcon },
  { id: "area", group: "Anotações", label: "Área", elementType: "area", icon: LayoutGrid },
];
export const PALETTE_GROUPS: PaletteGroup[] = [
  "Mesas e postos",
  "Ambientes",
  "Construção",
  "Equipamentos",
  "Anotações",
];

export function getEditorTool(id: EditorToolId): EditorTool {
  return EDITOR_TOOLS.find((t) => t.id === id) ?? EDITOR_TOOLS[0];
}

export function getElementIcon(type: StructureElementType): LucideIcon {
  switch (type) {
    case "desk-single":
    case "desk-double":
    case "workstation":
      return Monitor;
    case "text":
      return Type;
    case "image":
      return ImageIcon;
    case "area":
    case "sector":
      return LayoutGrid;
    default:
      return LayoutGrid;
  }
}

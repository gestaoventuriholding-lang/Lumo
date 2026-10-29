import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid3x3, Magnet, Redo2, Trash2, Undo2 } from "lucide-react";
import { EDITOR_TOOLS, type EditorToolId } from "@/lib/structureEditorTools";
import { cn } from "@/lib/utils";

interface StructureEditorToolbarProps {
  activeTool: EditorToolId;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (tool: EditorToolId) => void;
  onZoomChange: (zoom: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canDelete: boolean;
  onDelete: () => void;
  showGrid: boolean;
  snapToGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  onSnapToGridChange: (value: boolean) => void;
}

const ZOOM_OPTIONS = [
  { value: "0.5", label: "50%" },
  { value: "0.75", label: "75%" },
  { value: "1", label: "100%" },
  { value: "1.25", label: "125%" },
  { value: "1.5", label: "150%" },
];

export default function StructureEditorToolbar({
  activeTool,
  zoom,
  canUndo,
  canRedo,
  onToolChange,
  onZoomChange,
  onUndo,
  onRedo,
  canDelete,
  onDelete,
  showGrid,
  snapToGrid,
  onShowGridChange,
  onSnapToGridChange,
}: StructureEditorToolbarProps) {
  return (
    <div className="lumo-panel-sm flex shrink-0 items-center justify-between gap-3 px-3 py-2">
      <div className="flex items-center gap-1">
        {EDITOR_TOOLS.map((tool) => (
          <Button
            key={tool.id}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 gap-1.5 px-2.5 text-xs font-medium",
              activeTool === tool.id && "bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
            )}
            onClick={() => onToolChange(tool.id)}
          >
            <tool.icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{tool.label}</span>
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showGrid}
          className={cn("h-8 gap-1.5 px-2.5 text-xs", showGrid && "bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-blue-950/40 dark:text-blue-300")}
          onClick={() => onShowGridChange(!showGrid)}
          title="Mostrar ou ocultar a grade"
        >
          <Grid3x3 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Grade</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={snapToGrid}
          className={cn("h-8 gap-1.5 px-2.5 text-xs", snapToGrid && "bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-blue-950/40 dark:text-blue-300")}
          onClick={() => onSnapToGridChange(!snapToGrid)}
          title="Encaixar elementos na grade ao mover e redimensionar. Desligado, você posiciona livremente"
        >
          <Magnet className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Encaixar</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={!canDelete}
          onClick={onDelete}
          title="Excluir elemento selecionado (Delete)"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Excluir</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canUndo}
          onClick={onUndo}
          title="Desfazer"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={!canRedo}
          onClick={onRedo}
          title="Refazer"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
        <Select value={String(zoom)} onValueChange={(v) => onZoomChange(Number(v))}>
          <SelectTrigger className="h-8 w-[5.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ZOOM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

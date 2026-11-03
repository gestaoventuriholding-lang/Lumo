import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { STRUCTURE_PALETTE } from "@/lib/structureEditorTools";
import type { StructureElementType } from "@/types/structure";

interface StructureHeaderProps {
  onSave: () => void;
  onAddElement: (type: StructureElementType) => void;
}

export default function StructureHeader({ onSave, onAddElement }: StructureHeaderProps) {
  return (
    <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Estruturas</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Layout conectado ao desempenho e ausências do dia — clique em uma mesa para ver detalhes
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            onSave();
            toast.success("Estrutura salva");
          }}
        >
          <Save className="h-4 w-4" />
          Salvar estrutura
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo elemento
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
            {STRUCTURE_PALETTE.map((tool) => (
              <DropdownMenuItem
                key={tool.id}
                onClick={() => onAddElement(tool.elementType)}
              >
                <tool.icon className="h-4 w-4 mr-2" />
                {tool.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

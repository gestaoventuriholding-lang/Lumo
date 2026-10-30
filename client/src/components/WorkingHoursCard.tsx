import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLumoData } from "@/contexts/LumoDataContext";
import { newId } from "@/lib/ids";

/** Cargas horárias que aparecem ao cadastrar um colaborador. Começa vazia: cada central define as suas */
export default function WorkingHoursCard() {
  const { attendants, workingHoursOptions, setWorkingHoursOptions } = useLumoData();
  const [label, setLabel] = useState("");

  const handleAdd = () => {
    const value = label.trim();
    if (!value) {
      toast.error("Digite a carga horária, por exemplo 6h20 ou 12x36");
      return;
    }
    if (workingHoursOptions.some((o) => o.label.toLowerCase() === value.toLowerCase())) {
      toast.error("Essa carga horária já está na lista");
      return;
    }
    setWorkingHoursOptions([
      ...workingHoursOptions,
      { id: newId(), label: value, createdAt: new Date().toISOString().slice(0, 10) },
    ]);
    setLabel("");
    toast.success("Carga horária adicionada");
  };

  const handleRemove = (id: number) => {
    const option = workingHoursOptions.find((o) => o.id === id);
    if (!option) return;
    setWorkingHoursOptions(workingHoursOptions.filter((o) => o.id !== id));
    toast.success(`${option.label} removida da lista`);
  };

  return (
    <div className="space-y-4">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleAdd();
        }}
      >
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: 6h20, 8h ou 12x36"
          maxLength={40}
          aria-label="Nova carga horária"
          className="sm:max-w-xs"
        />
        <Button type="submit" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar carga horária
        </Button>
      </form>

      {workingHoursOptions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
          Nenhuma carga horária cadastrada. Adicione as que existem na sua central para poder
          escolhê-las ao cadastrar colaboradores.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {workingHoursOptions.map((option) => {
            const inUse = attendants.filter((a) => a.workingHours === option.label).length;
            return (
              <li key={option.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {inUse === 0
                      ? "Nenhum colaborador usa"
                      : inUse === 1
                        ? "1 colaborador usa"
                        : `${inUse} colaboradores usam`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${option.label}`}
                  onClick={() => handleRemove(option.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Remover uma carga horária da lista não muda quem já a usa: o colaborador continua com o valor
        que tem.
      </p>
    </div>
  );
}

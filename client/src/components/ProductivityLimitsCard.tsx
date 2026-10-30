import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLumoData } from "@/contexts/LumoDataContext";
import { newId } from "@/lib/ids";
import { LIMIT_DEFINITIONS } from "@/lib/productivityLimits";
import type { ProductivityLimit, ProductivityLimitMetric } from "@/types/productivity";

type Draft = Record<ProductivityLimitMetric, { value: string; active: boolean }>;

function toDraft(limits: ProductivityLimit[]): Draft {
  const draft = {} as Draft;
  LIMIT_DEFINITIONS.forEach((def) => {
    const found = limits.find((l) => l.metric === def.metric);
    draft[def.metric] = {
      value: String(found?.value ?? def.suggested),
      active: found ? found.status === "Ativo" : false,
    };
  });
  return draft;
}

/** Limites de pausa e ocupação: geram os alertas do relatório importado */
export default function ProductivityLimitsCard() {
  const { productivityLimits, setProductivityLimits } = useLumoData();
  const [draft, setDraft] = useState<Draft>(() => toDraft(productivityLimits));

  const update = (metric: ProductivityLimitMetric, patch: Partial<Draft[ProductivityLimitMetric]>) =>
    setDraft((prev) => ({ ...prev, [metric]: { ...prev[metric], ...patch } }));

  const handleSave = () => {
    const today = new Date().toISOString().slice(0, 10);
    const next: ProductivityLimit[] = [];
    for (const def of LIMIT_DEFINITIONS) {
      const item = draft[def.metric];
      const value = Number(item.value.replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        toast.error(`${def.label}: informe um valor entre 0 e 100`);
        return;
      }
      const existing = productivityLimits.find((l) => l.metric === def.metric);
      // sem limite ativo e sem registro anterior, não cria linha à toa
      if (!existing && !item.active) continue;
      next.push({
        id: existing?.id ?? newId(),
        metric: def.metric,
        value,
        status: item.active ? "Ativo" : "Inativo",
        createdAt: existing?.createdAt ?? today,
        updatedAt: today,
      });
    }
    setProductivityLimits(next);
    toast.success("Limites salvos");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {LIMIT_DEFINITIONS.map((def) => {
          const item = draft[def.metric];
          const inputId = `limit-${def.metric}`;
          return (
            <div
              key={def.metric}
              className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Label htmlFor={inputId} className="text-sm font-semibold">
                  {def.label} {def.direction === "max" ? "(máximo)" : "(mínimo)"}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{def.hint}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    id={inputId}
                    inputMode="decimal"
                    className="h-9 w-20 text-right tabular-nums"
                    value={item.value}
                    onChange={(e) => update(def.metric, { value: e.target.value })}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <Switch
                  checked={item.active}
                  onCheckedChange={(checked) => update(def.metric, { active: checked })}
                  aria-label={`${item.active ? "Desativar" : "Ativar"} limite de ${def.label.toLowerCase()}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Só os limites ligados geram alertas e cores. Eles valem para o relatório de produtividade mais
        recente importado.
      </p>
      <Button onClick={handleSave}>Salvar limites</Button>
    </div>
  );
}

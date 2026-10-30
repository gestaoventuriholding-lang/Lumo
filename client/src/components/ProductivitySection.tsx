import { useMemo, useState } from "react";
import { AlertTriangle, Info, Percent, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { summarizeProductivity, type ProductivitySummaryRow } from "@/lib/productivityMetrics";
import { formatBrDate, formatPercent, formatSecondsShort } from "@/lib/reportFormat";
import { activeLimit, evaluateLimit } from "@/lib/productivityLimits";
import { cn } from "@/lib/utils";
import type { AlertLevel } from "@/types/goals";
import type { ProductivityLimit, ProductivityRecord } from "@/types/productivity";

const levelText: Record<AlertLevel, string> = {
  green: "font-semibold text-emerald-600 dark:text-emerald-400",
  yellow: "font-semibold text-amber-600 dark:text-amber-400",
  red: "font-semibold text-red-600 dark:text-red-400",
};

function levelClass(level?: AlertLevel): string {
  return level ? levelText[level] : "";
}

function Indicator({
  icon: Icon,
  label,
  value,
  note,
  level,
}: {
  icon: typeof Percent;
  label: string;
  value: string;
  note: string;
  level?: AlertLevel;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold tabular-nums", level && levelText[level])}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

interface ProductivitySectionProps {
  records: ProductivityRecord[];
  attendantIds: Set<number>;
  range: { start: string; end: string; label: string };
  limits: ProductivityLimit[];
  onRemove: (recordIds: number[]) => void;
}

/** Tempo logado, pausas e ocupação, vindos dos relatórios de produtividade importados */
export default function ProductivitySection({ records, attendantIds, range, limits, onRemove }: ProductivitySectionProps) {
  const [toRemove, setToRemove] = useState<ProductivitySummaryRow | null>(null);
  const summary = useMemo(
    () => summarizeProductivity(records, range, attendantIds),
    [records, range.start, range.end, attendantIds]
  );

  const unproductiveLimit = activeLimit(limits, "pause_unproductive_percent");
  const pauseLimit = activeLimit(limits, "pause_percent");
  const occupancyLimit = activeLimit(limits, "occupancy_min");

  const overview = useMemo(() => {
    const rows = summary.rows;
    const login = rows.reduce((acc, r) => acc + (r.loginSeconds ?? 0), 0);
    const unproductive = rows.reduce((acc, r) => acc + (r.pauseUnproductiveSeconds ?? 0), 0);
    const hasUnproductive = rows.some((r) => r.pauseUnproductiveSeconds != null);
    const occRows = rows.filter((r) => r.occupancy != null && (r.loginSeconds ?? 0) > 0);
    const occBase = occRows.reduce((acc, r) => acc + (r.loginSeconds ?? 0), 0);
    const occupancy =
      occBase > 0
        ? Math.round((occRows.reduce((acc, r) => acc + (r.occupancy ?? 0) * (r.loginSeconds ?? 0), 0) / occBase) * 10) / 10
        : undefined;
    const unproductivePercent =
      login > 0 && hasUnproductive ? Math.round((unproductive / login) * 1000) / 10 : undefined;
    const outside = new Set(
      rows
        .filter(
          (r) =>
            evaluateLimit("max", r.pauseUnproductivePercent, unproductiveLimit) === "red" ||
            evaluateLimit("max", r.pausePercent, pauseLimit) === "red" ||
            evaluateLimit("min", r.occupancy, occupancyLimit) === "red"
        )
        .map((r) => r.attendantId)
    ).size;
    return { unproductivePercent, occupancy, outside };
  }, [summary.rows, unproductiveLimit, pauseLimit, occupancyLimit]);

  if (summary.rows.length === 0) return null;

  const hasLimits = [unproductiveLimit, pauseLimit, occupancyLimit].some((v) => v != null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtividade e pausas</CardTitle>
        <CardDescription>
          Tempo logado, pausas e taxa de ocupação dos relatórios importados · {range.label}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Indicator
            icon={Timer}
            label="Pausa improdutiva"
            value={formatPercent(overview.unproductivePercent)}
            note={unproductiveLimit != null ? `Limite: até ${unproductiveLimit}% do tempo logado` : "Sem limite definido"}
            level={evaluateLimit("max", overview.unproductivePercent, unproductiveLimit)}
          />
          <Indicator
            icon={Percent}
            label="Ocupação média"
            value={formatPercent(overview.occupancy)}
            note={occupancyLimit != null ? `Mínimo esperado: ${occupancyLimit}%` : "Sem limite definido"}
            level={evaluateLimit("min", overview.occupancy, occupancyLimit)}
          />
          <Indicator
            icon={AlertTriangle}
            label="Fora do limite"
            value={hasLimits ? `${overview.outside} de ${new Set(summary.rows.map((r) => r.attendantId)).size}` : "—"}
            note={hasLimits ? "Pessoas acima da pausa ou abaixo da ocupação" : "Defina os limites em Configurações"}
            level={hasLimits ? (overview.outside > 0 ? "red" : "green") : undefined}
          />
        </div>
        {summary.widerPeriods.length > 0 && (
          <p className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Inclui totais de relatório que cobrem um período maior que o filtro:{" "}
            {summary.widerPeriods
              .map((p) => `${formatBrDate(p.start)} a ${formatBrDate(p.end)}`)
              .join(", ")}
            . Esses valores não são divididos por dia.
          </p>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Colaborador</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Saída</TableHead>
                <TableHead className="text-right">TMA</TableHead>
                <TableHead className="text-right">Logado</TableHead>
                <TableHead className="text-right">Pausa</TableHead>
                <TableHead className="text-right">% Pausa</TableHead>
                <TableHead className="text-right">% Improdutiva</TableHead>
                <TableHead className="text-right">Ocupação</TableHead>
                <TableHead className="text-right">Atend./hora</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.rows.map((row) => (
                <TableRow key={`${row.attendantId}-${row.channel}`}>
                  <TableCell className="whitespace-nowrap font-medium">{row.attendantName}</TableCell>
                  <TableCell className="text-muted-foreground">{row.channel}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.inbound.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.outbound.toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSecondsShort(row.tmaSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSecondsShort(row.loginSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSecondsShort(row.pauseSeconds)}</TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", levelClass(evaluateLimit("max", row.pausePercent, pauseLimit)))}
                  >
                    {formatPercent(row.pausePercent)}
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", levelClass(evaluateLimit("max", row.pauseUnproductivePercent, unproductiveLimit)))}
                  >
                    {formatPercent(row.pauseUnproductivePercent)}
                  </TableCell>
                  <TableCell
                    className={cn("text-right tabular-nums", levelClass(evaluateLimit("min", row.occupancy, occupancyLimit)))}
                  >
                    {formatPercent(row.occupancy)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.perHour != null ? row.perHour.toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Excluir dados importados de ${row.attendantName}`}
                      onClick={() => setToRemove(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <AlertDialog open={toRemove != null} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir os dados importados de {toRemove?.attendantName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remove só os relatórios de produtividade desta pessoa ({toRemove?.channel}) que aparecem
              neste período. Os dados dos outros colaboradores não mudam. Para voltar, importe o relatório de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!toRemove) return;
                onRemove(toRemove.recordIds);
                toast.success("Dados excluídos", { description: toRemove.attendantName });
                setToRemove(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

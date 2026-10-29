import { useMemo, useState } from "react";
import { Info, Trash2 } from "lucide-react";
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
import type { ProductivityRecord } from "@/types/productivity";

interface ProductivitySectionProps {
  records: ProductivityRecord[];
  attendantIds: Set<number>;
  range: { start: string; end: string; label: string };
  onRemove: (recordIds: number[]) => void;
}

/** Tempo logado, pausas e ocupação, vindos dos relatórios de produtividade importados */
export default function ProductivitySection({ records, attendantIds, range, onRemove }: ProductivitySectionProps) {
  const [toRemove, setToRemove] = useState<ProductivitySummaryRow | null>(null);
  const summary = useMemo(
    () => summarizeProductivity(records, range, attendantIds),
    [records, range.start, range.end, attendantIds]
  );

  if (summary.rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtividade e pausas</CardTitle>
        <CardDescription>
          Tempo logado, pausas e taxa de ocupação dos relatórios importados · {range.label}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
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
                  <TableCell className="text-right tabular-nums">{formatPercent(row.pausePercent)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.occupancy)}</TableCell>
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

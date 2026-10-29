import { useMemo } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { summarizeProductivity } from "@/lib/productivityMetrics";
import { formatBrDate, formatPercent, formatSecondsShort } from "@/lib/reportFormat";
import type { ProductivityRecord } from "@/types/productivity";

interface ProductivitySectionProps {
  records: ProductivityRecord[];
  attendantIds: Set<number>;
  range: { start: string; end: string; label: string };
}

/** Tempo logado, pausas e ocupação, vindos dos relatórios de produtividade importados */
export default function ProductivitySection({ records, attendantIds, range }: ProductivitySectionProps) {
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

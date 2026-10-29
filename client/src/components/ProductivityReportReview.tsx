import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductivityReport } from "@/lib/reportParser";
import type { ProductivityImportPreview } from "@/lib/productivityImport";
import { formatPercent, formatSecondsShort, formatBrDate } from "@/lib/reportFormat";
import { normalizeText } from "@/lib/reportParser";
import type { AttendanceChannel } from "@/types/goals";

interface ProductivityReportReviewProps {
  report: ProductivityReport;
  preview: ProductivityImportPreview;
  channel: AttendanceChannel | "";
  onChannelChange: (channel: AttendanceChannel) => void;
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  createAttendants: boolean;
  onCreateAttendantsChange: (value: boolean) => void;
}

export default function ProductivityReportReview({
  report,
  preview,
  channel,
  onChannelChange,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
  createAttendants,
  onCreateAttendantsChange,
}: ProductivityReportReviewProps) {
  const isNew = new Set(preview.toCreate.map(normalizeText));
  const isRepeat = new Set(preview.alreadyImported.map(normalizeText));
  const dailyDates = Array.from(
    new Set(report.rows.map((r) => r.date).filter((d): d is string => Boolean(d)))
  ).sort();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/30">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-green-900 dark:text-green-300">
              Reconheci o relatório {report.reportCode ? `${report.reportCode} — ` : ""}
              {report.title}
            </p>
            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
              {report.rows.length} colaborador{report.rows.length === 1 ? "" : "es"} encontrado
              {report.rows.length === 1 ? "" : "s"}.{" "}
              {report.mode === "daily"
                ? dailyDates.length > 1
                  ? `Relatório por dia (${dailyDates.length} dias): cada dia será gravado separado e alimenta os gráficos diários.`
                  : `Relatório de um dia (${formatBrDate(dailyDates[0])}): alimenta os gráficos diários.`
                : "Totais do período inteiro: ficam guardados como total do período, sem dividir por dia."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {report.recognizedFields.map((field) => (
            <Badge key={field} variant="secondary" className="text-[11px] font-normal">
              {field}
            </Badge>
          ))}
        </div>
      </div>

      {report.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
            {report.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="report-channel">Canal</Label>
          <Select value={channel} onValueChange={(v) => onChannelChange(v as AttendanceChannel)}>
            <SelectTrigger id="report-channel">
              <SelectValue placeholder="Escolha o canal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WhatsApp">WhatsApp (Chat)</SelectItem>
              <SelectItem value="Ligação">Ligação (Voz)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {report.mode === "period" && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="report-start">Início do período</Label>
              <Input
                id="report-start"
                type="date"
                value={periodStart}
                onChange={(e) => onPeriodStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-end">Fim do período</Label>
              <Input
                id="report-end"
                type="date"
                value={periodEnd}
                onChange={(e) => onPeriodEndChange(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
              <TableHead className="text-right">Saída</TableHead>
              <TableHead className="text-right">TMA</TableHead>
              <TableHead className="text-right">Logado</TableHead>
              <TableHead className="text-right">Pausa</TableHead>
              <TableHead className="text-right">Ocupação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.rows.slice(0, 50).map((row, index) => {
              const key = normalizeText(row.attendantName);
              return (
                <TableRow key={`${row.attendantName}-${row.date ?? index}`}>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-medium">{row.attendantName}</span>
                    {report.mode === "daily" && row.date && (
                      <span className="ml-2 text-xs text-muted-foreground">{formatBrDate(row.date)}</span>
                    )}
                    {isNew.has(key) && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        Novo
                      </Badge>
                    )}
                    {isRepeat.has(key) && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Já importado
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.inbound ?? row.total}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.outbound ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSecondsShort(row.tmaSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSecondsShort(row.loginSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatSecondsShort(row.pauseSeconds)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(row.occupancy1)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {report.rows.length > 50 && (
        <p className="text-xs text-muted-foreground">
          Mostrando 50 de {report.rows.length} linhas. Todas serão importadas.
        </p>
      )}

      <div className="space-y-2.5 rounded-lg border border-border p-3">
        <label className="flex cursor-pointer items-start gap-3">
          <Checkbox
            checked={createAttendants}
            onCheckedChange={(checked) => onCreateAttendantsChange(checked === true)}
          />
          <span className="text-sm leading-snug">
            Criar colaboradores que ainda não existem no Elos
            {preview.toCreate.length > 0 && ` (${preview.toCreate.length} neste arquivo)`}
          </span>
        </label>
        {preview.alreadyImported.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {preview.alreadyImported.length} colaborador(es) já têm este período importado. Importar de novo
            atualiza os valores, sem duplicar.
          </p>
        )}
      </div>
    </div>
  );
}

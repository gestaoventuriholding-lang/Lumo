import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLumoData } from "@/contexts/LumoDataContext";
import { usePeriodFilter } from "@/contexts/PeriodFilterContext";
import type { DashboardPeriod } from "@/lib/dateRangeFilter";
import { getMonthString } from "@/lib/dateRangeFilter";
import { mergePeriodTotals } from "@/lib/periodTotals";
import { getLocalDateString } from "@/lib/performanceStorage";
import {
  buildManagementReportPreview,
  getAttendantsWithRecordsInRange,
  hasManagementReportContent,
  resolveManagementReportDateRange,
  type ManagementReportChannelFilter,
  type ManagementReportOptions,
} from "@/lib/managementReport";

type ManagementReportButtonProps = {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

function defaultPeriodValue(period: DashboardPeriod): string {
  if (period === "month") return getMonthString();
  return getLocalDateString();
}

export default function ManagementReportButton({
  variant = "outline",
  size = "default",
  className,
}: ManagementReportButtonProps) {
  const { attendants, performanceRecords: dailyRecords, productivityRecords, productionGoals } = useLumoData();
  const { period, selectedDay, selectedWeek, selectedMonth } = usePeriodFilter();

  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<DashboardPeriod>(period);
  const [periodValue, setPeriodValue] = useState(() => {
    if (period === "day") return selectedDay;
    if (period === "week") return selectedWeek;
    return selectedMonth;
  });
  const [channels, setChannels] = useState<ManagementReportChannelFilter>("both");
  const [allAttendants, setAllAttendants] = useState(true);
  const [selectedAttendantIds, setSelectedAttendantIds] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setReportPeriod(period);
    setPeriodValue(
      period === "day" ? selectedDay : period === "week" ? selectedWeek : selectedMonth
    );
    setChannels("both");
    setAllAttendants(true);
    setSelectedAttendantIds([]);
  }, [open, period, selectedDay, selectedWeek, selectedMonth]);

  const dateRange = useMemo(
    () => resolveManagementReportDateRange({ period: reportPeriod, periodValue }),
    [reportPeriod, periodValue]
  );

  const performanceRecords = useMemo(
    () => mergePeriodTotals(dailyRecords, productivityRecords, dateRange),
    [dailyRecords, productivityRecords, dateRange]
  );

  const attendantsInRange = useMemo(
    () => getAttendantsWithRecordsInRange(performanceRecords, attendants, dateRange),
    [performanceRecords, attendants, dateRange]
  );

  const effectiveAttendantIds = useMemo(() => {
    if (allAttendants) return null;
    return selectedAttendantIds;
  }, [allAttendants, selectedAttendantIds]);

  const reportOptions: ManagementReportOptions = useMemo(
    () => ({
      period: reportPeriod,
      periodValue,
      attendantIds: effectiveAttendantIds,
      channels,
    }),
    [reportPeriod, periodValue, effectiveAttendantIds, channels]
  );

  const preview = useMemo(
    () =>
      buildManagementReportPreview(
        attendants,
        performanceRecords,
        productionGoals,
        reportOptions
      ),
    [attendants, performanceRecords, productionGoals, reportOptions]
  );

  const handlePeriodChange = (next: DashboardPeriod) => {
    setReportPeriod(next);
    setPeriodValue(defaultPeriodValue(next));
  };

  const toggleAttendant = (id: number, checked: boolean) => {
    setSelectedAttendantIds((prev) => {
      if (checked) return [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handleGenerate = async () => {
    if (!allAttendants && selectedAttendantIds.length === 0) {
      toast.error("Selecione ao menos um colaborador");
      return;
    }

    if (!hasManagementReportContent(preview)) {
      toast.error("Sem dados para o relatório", {
        description: "Ajuste dia, colaboradores ou canal e tente novamente.",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { generateManagementReportPdfAsync } = await import("@/lib/managementReportPdf");
      await generateManagementReportPdfAsync(preview);
      toast.success("Relatório gerencial gerado", {
        description: `${preview.dateRange.label} · ${preview.filtersLabel}`,
      });
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={() => setOpen(true)}
      >
        <FileText className="h-4 w-4" />
        Relatório PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90dvh,calc(100vh-2rem))] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4">
            <DialogTitle>Relatório gerencial em PDF</DialogTitle>
            <DialogDescription>
              Escolha o período, colaboradores e canais antes de exportar.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <section className="space-y-3">
              <p className="text-sm font-medium text-foreground">Período</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <Select
                    value={reportPeriod}
                    onValueChange={(value) => handlePeriodChange(value as DashboardPeriod)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Dia</SelectItem>
                      <SelectItem value="week">Semana</SelectItem>
                      <SelectItem value="month">Mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {reportPeriod === "day" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dia</Label>
                    <Input
                      type="date"
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                    />
                  </div>
                )}

                {reportPeriod === "week" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Semana (escolha um dia)</Label>
                    <Input
                      type="date"
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                    />
                  </div>
                )}

                {reportPeriod === "month" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Mês</Label>
                    <Input
                      type="month"
                      value={periodValue}
                      onChange={(e) => setPeriodValue(e.target.value)}
                    />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{dateRange.label}</p>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-foreground">Canal</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { value: "both", label: "Ambos" },
                    { value: "Ligação", label: "Ligação" },
                    { value: "WhatsApp", label: "WhatsApp" },
                  ] as const
                ).map((item) => (
                  <label
                    key={item.value}
                    className={`flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      channels === item.value
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="report-channel"
                      className="sr-only"
                      checked={channels === item.value}
                      onChange={() => setChannels(item.value)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-sm font-medium text-foreground">Colaboradores</p>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={allAttendants}
                  onCheckedChange={(checked) => setAllAttendants(checked === true)}
                />
                <span className="text-sm leading-snug">
                  Incluir todos os colaboradores
                  {attendantsInRange.length > 0 && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {attendantsInRange.length} com registro no período
                    </span>
                  )}
                </span>
              </label>

              {!allAttendants && (
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {attendants.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado</p>
                  ) : (
                    attendants.map((attendant) => {
                      const hasData = attendantsInRange.some((item) => item.id === attendant.id);
                      return (
                        <label
                          key={attendant.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selectedAttendantIds.includes(attendant.id)}
                            onCheckedChange={(checked) =>
                              toggleAttendant(attendant.id, checked === true)
                            }
                          />
                          <span className={hasData ? "" : "text-muted-foreground"}>
                            {attendant.name}
                            {!hasData ? " (sem registro no período)" : ""}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1.5">
              <p className="font-medium text-foreground">Prévia do relatório</p>
              <p className="text-muted-foreground">{preview.filtersLabel}</p>
              <p className="text-muted-foreground">
                {preview.summary.totalAttendances} atendimento(s) ·{" "}
                {preview.summary.attendantsWithRecords} colaborador(es) com registro
              </p>
              {channels !== "both" && (
                <p className="text-xs text-muted-foreground">
                  Ranking e abaixo da meta só do canal selecionado.
                </p>
              )}
            </section>
          </div>

          <DialogFooter className="shrink-0 gap-2 border-t border-border px-5 py-3">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>
              Cancelar
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !hasManagementReportContent(preview)}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Gerar PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEllosData } from "@/contexts/EllosDataContext";
import { getLocalDateString } from "@/lib/performanceStorage";
import { getMonthString } from "@/lib/dateRangeFilter";
import {
  buildExportPreview,
  DATASET_LABELS,
  executeExport,
  type ExportDataset,
  type ExportOptions,
  type ExportPeriodType,
} from "@/lib/spreadsheetExport";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ALL_DATASETS: ExportDataset[] = [
  "performance",
  "attendants",
  "absences",
  "productionGoals",
  "roleGoals",
];

const PERIOD_DATASETS = new Set<ExportDataset>(["performance", "absences"]);

function defaultPeriodValue(type: ExportPeriodType): string {
  if (type === "month") return getMonthString();
  return getLocalDateString();
}

export default function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const {
    attendants,
    performanceRecords,
    absences,
    productionGoals,
    roleGoals,
  } = useEllosData();

  const [datasets, setDatasets] = useState<ExportDataset[]>(["performance"]);
  const [periodType, setPeriodType] = useState<ExportPeriodType>("month");
  const [periodValue, setPeriodValue] = useState(getMonthString());
  const [customStart, setCustomStart] = useState(getLocalDateString());
  const [customEnd, setCustomEnd] = useState(getLocalDateString());
  const [selectedAttendantIds, setSelectedAttendantIds] = useState<number[]>([]);
  const [filterAttendants, setFilterAttendants] = useState(false);
  const [format, setFormat] = useState<"csv" | "xlsx">("xlsx");
  const [isExporting, setIsExporting] = useState(false);

  const options: ExportOptions = useMemo(
    () => ({
      datasets,
      period: {
        type: periodType,
        value: periodValue,
        customStart,
        customEnd,
      },
      attendantIds: filterAttendants && selectedAttendantIds.length > 0 ? selectedAttendantIds : null,
      format,
    }),
    [
      datasets,
      periodType,
      periodValue,
      customStart,
      customEnd,
      filterAttendants,
      selectedAttendantIds,
      format,
    ]
  );

  const sources = useMemo(
    () => ({
      attendants,
      performanceRecords,
      absences,
      productionGoals,
      roleGoals,
    }),
    [attendants, performanceRecords, absences, productionGoals, roleGoals]
  );

  const preview = useMemo(() => buildExportPreview(sources, options), [sources, options]);
  const totalRecords = preview.reduce((sum, item) => sum + item.count, 0);
  const usesPeriodFilter = datasets.some((dataset) => PERIOD_DATASETS.has(dataset));

  useEffect(() => {
    if (!open) return;
    setDatasets(["performance"]);
    setPeriodType("month");
    setPeriodValue(getMonthString());
    setCustomStart(getLocalDateString());
    setCustomEnd(getLocalDateString());
    setSelectedAttendantIds([]);
    setFilterAttendants(false);
    setFormat("xlsx");
    setIsExporting(false);
  }, [open]);

  const toggleDataset = (dataset: ExportDataset, checked: boolean) => {
    setDatasets((prev) => {
      if (checked) return [...prev, dataset];
      return prev.filter((item) => item !== dataset);
    });
  };

  const toggleAttendant = (id: number, checked: boolean) => {
    setSelectedAttendantIds((prev) => {
      if (checked) return [...prev, id];
      return prev.filter((item) => item !== id);
    });
  };

  const handlePeriodTypeChange = (value: ExportPeriodType) => {
    setPeriodType(value);
    if (value !== "all" && value !== "custom") {
      setPeriodValue(defaultPeriodValue(value));
    }
  };

  const handleExport = () => {
    if (datasets.length === 0) {
      toast.error("Selecione pelo menos um tipo de dado");
      return;
    }

    if (filterAttendants && selectedAttendantIds.length === 0) {
      toast.error("Selecione ao menos um colaborador ou desative o filtro");
      return;
    }

    setIsExporting(true);
    try {
      executeExport(sources, options);
      toast.success("Exportação concluída", {
        description:
          format === "xlsx"
            ? `${totalRecords} registro(s) em arquivo Excel`
            : `${totalRecords} registro(s) exportado(s)`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4">
          <DialogTitle>Exportar Dados</DialogTitle>
          <DialogDescription>
            Escolha o que exportar, o período e o formato do arquivo.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            <section className="space-y-3">
              <p className="text-sm font-medium text-foreground">O que exportar</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_DATASETS.map((dataset) => (
                  <label
                    key={dataset}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={datasets.includes(dataset)}
                      onCheckedChange={(checked) => toggleDataset(dataset, checked === true)}
                    />
                    <span className="text-sm leading-snug">
                      <span className="font-medium text-foreground block">
                        {DATASET_LABELS[dataset]}
                      </span>
                      {PERIOD_DATASETS.has(dataset) && (
                        <span className="text-xs text-muted-foreground">Respeita filtro de período</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {usesPeriodFilter && (
              <section className="space-y-4 rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">Período</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo de período</Label>
                    <Select
                      value={periodType}
                      onValueChange={(value) => handlePeriodTypeChange(value as ExportPeriodType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os registros</SelectItem>
                        <SelectItem value="day">Por dia</SelectItem>
                        <SelectItem value="week">Por semana</SelectItem>
                        <SelectItem value="month">Por mês</SelectItem>
                        <SelectItem value="custom">Intervalo personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {periodType === "day" && (
                    <div className="space-y-2">
                      <Label>Dia</Label>
                      <Input
                        type="date"
                        value={periodValue}
                        onChange={(e) => setPeriodValue(e.target.value)}
                      />
                    </div>
                  )}

                  {periodType === "week" && (
                    <div className="space-y-2">
                      <Label>Semana (escolha um dia)</Label>
                      <Input
                        type="date"
                        value={periodValue}
                        onChange={(e) => setPeriodValue(e.target.value)}
                      />
                    </div>
                  )}

                  {periodType === "month" && (
                    <div className="space-y-2">
                      <Label>Mês</Label>
                      <Input
                        type="month"
                        value={periodValue}
                        onChange={(e) => setPeriodValue(e.target.value)}
                      />
                    </div>
                  )}

                  {periodType === "custom" && (
                    <>
                      <div className="space-y-2">
                        <Label>Data inicial</Label>
                        <Input
                          type="date"
                          value={customStart}
                          onChange={(e) => setCustomStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data final</Label>
                        <Input
                          type="date"
                          value={customEnd}
                          onChange={(e) => setCustomEnd(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              </section>
            )}

            {(datasets.includes("performance") ||
              datasets.includes("absences") ||
              datasets.includes("attendants")) && (
              <section className="space-y-3 rounded-lg border border-border p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={filterAttendants}
                    onCheckedChange={(checked) => setFilterAttendants(checked === true)}
                  />
                  <span className="text-sm leading-snug">
                    Filtrar por colaboradores específicos
                  </span>
                </label>

                {filterAttendants && (
                  <div className="grid gap-2 sm:grid-cols-2 max-h-40 overflow-y-auto pl-1">
                    {attendants.length === 0 ? (
                      <p className="text-sm text-muted-foreground col-span-2">
                        Nenhum colaborador cadastrado
                      </p>
                    ) : (
                      attendants.map((attendant) => (
                        <label
                          key={attendant.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedAttendantIds.includes(attendant.id)}
                            onCheckedChange={(checked) =>
                              toggleAttendant(attendant.id, checked === true)
                            }
                          />
                          {attendant.name}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </section>
            )}

            <section className="space-y-3">
              <p className="text-sm font-medium text-foreground">Formato</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
                  <input
                    type="radio"
                    name="export-format"
                    checked={format === "xlsx"}
                    onChange={() => setFormat("xlsx")}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <FileSpreadsheet className="h-4 w-4" />
                      Excel (.xlsx)
                    </span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Uma aba por tipo de dado selecionado
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
                  <input
                    type="radio"
                    name="export-format"
                    checked={format === "csv"}
                    onChange={() => setFormat("csv")}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-foreground">CSV (;)</span>
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      Um arquivo por tipo se houver mais de um dado
                    </span>
                  </span>
                </label>
              </div>
            </section>

            {preview.length > 0 && (
              <section className="space-y-3 rounded-lg bg-muted/20 border border-border p-4">
                <p className="text-sm font-medium text-foreground">Resumo</p>
                <div className="space-y-2">
                  {preview.map((item) => (
                    <div key={item.dataset} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-foreground">{item.count} registro(s)</span>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground pt-1 border-t border-border">
                  Total: <span className="font-medium text-foreground">{totalRecords}</span> registro(s)
                </p>
              </section>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border bg-background px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || datasets.length === 0 || totalRecords === 0}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

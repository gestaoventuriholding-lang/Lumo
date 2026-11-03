import * as XLSX from "xlsx";
import type { Attendant } from "@/types/attendant";
import type { Absence, AbsenceStatus } from "@/types/absence";
import type { ProductionGoal, RoleGoal } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import { type DateRange, resolveDateRange, type DashboardPeriod } from "@/lib/dateRangeFilter";
import { filterRecordsByRange } from "@/lib/performanceMetrics";
import { filterAbsencesByRange, ABSENCE_TYPE_LABELS } from "@/lib/absenceMetrics";
import { formatJornada } from "@/lib/attendantSchedule";
import { formatAverageTime } from "@/lib/performanceStorage";

export type ExportDataset =
  | "performance"
  | "attendants"
  | "absences"
  | "productionGoals"
  | "roleGoals";

export type ExportPeriodType = "all" | DashboardPeriod | "custom";

export interface ExportPeriod {
  type: ExportPeriodType;
  value: string;
  customStart?: string;
  customEnd?: string;
}

export interface ExportOptions {
  datasets: ExportDataset[];
  period: ExportPeriod;
  attendantIds: number[] | null;
  format: "csv" | "xlsx";
}

export interface ExportDataSources {
  attendants: Attendant[];
  performanceRecords: DailyPerformanceRecord[];
  absences: Absence[];
  productionGoals: ProductionGoal[];
  roleGoals: RoleGoal[];
}

export interface ExportPreviewItem {
  dataset: ExportDataset;
  label: string;
  count: number;
  usesPeriod: boolean;
}

const DATASET_LABELS: Record<ExportDataset, string> = {
  performance: "Desempenho",
  attendants: "Colaboradores",
  absences: "Ausências",
  productionGoals: "Metas de produção",
  roleGoals: "Metas por função",
};

const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  approved: "Aprovada",
  pending: "Pendente",
  rejected: "Rejeitada",
};

function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function resolveExportDateRange(period: ExportPeriod): DateRange | null {
  if (period.type === "all") return null;

  if (period.type === "custom") {
    if (!period.customStart || !period.customEnd) return null;
    const start = period.customStart <= period.customEnd ? period.customStart : period.customEnd;
    const end = period.customStart <= period.customEnd ? period.customEnd : period.customStart;
    return {
      start,
      end,
      label: `${formatDateBR(start)} — ${formatDateBR(end)}`,
    };
  }

  return resolveDateRange(period.type, period.value);
}

function filterByAttendants<T extends { attendantId: number }>(
  items: T[],
  attendantIds: number[] | null
): T[] {
  if (!attendantIds || attendantIds.length === 0) return items;
  const set = new Set(attendantIds);
  return items.filter((item) => set.has(item.attendantId));
}

function filterAttendantsList(
  attendants: Attendant[],
  attendantIds: number[] | null
): Attendant[] {
  if (!attendantIds || attendantIds.length === 0) return attendants;
  const set = new Set(attendantIds);
  return attendants.filter((attendant) => set.has(attendant.id));
}

export function buildExportPreview(
  sources: ExportDataSources,
  options: ExportOptions
): ExportPreviewItem[] {
  const range = resolveExportDateRange(options.period);

  return options.datasets.map((dataset) => {
    const count = getFilteredRows(sources, options, dataset, range).length;
    return {
      dataset,
      label: DATASET_LABELS[dataset],
      count,
      usesPeriod: dataset === "performance" || dataset === "absences",
    };
  });
}

function getFilteredRows(
  sources: ExportDataSources,
  options: ExportOptions,
  dataset: ExportDataset,
  range: DateRange | null
): Record<string, string | number>[] {
  switch (dataset) {
    case "performance": {
      let records = sources.performanceRecords;
      if (range) records = filterRecordsByRange(records, range);
      records = filterByAttendants(records, options.attendantIds);
      return records.map((record) => ({
        Colaborador: record.attendantName,
        Data: formatDateBR(record.date),
        Canal: record.channel,
        Quantidade: record.attendancesCount,
        "Tempo Médio": formatAverageTime(record.averageTimeMinutes),
      }));
    }
    case "attendants":
      return filterAttendantsList(sources.attendants, options.attendantIds).map((attendant) => ({
        Nome: attendant.name,
        Função: attendant.role,
        "Horário de Trabalho": attendant.workingHours,
        Jornada: formatJornada(attendant) || "—",
        Observação: attendant.observation,
        "Data de Cadastro": formatDateBR(attendant.registrationDate.split("T")[0] ?? attendant.registrationDate),
      }));
    case "absences": {
      let absences = sources.absences;
      if (range) absences = filterAbsencesByRange(absences, range, { includeRejected: true });
      absences = filterByAttendants(absences, options.attendantIds);
      return absences.map((absence) => ({
        Colaborador: absence.attendantName,
        Tipo: ABSENCE_TYPE_LABELS[absence.type],
        "Data Início": formatDateBR(absence.startDate),
        "Data Fim": formatDateBR(absence.endDate),
        Motivo: absence.reason,
        Status: ABSENCE_STATUS_LABELS[absence.status],
      }));
    }
    case "productionGoals":
      return sources.productionGoals.map((goal) => ({
        Canal: goal.channel,
        "Meta Diária": goal.dailyTarget,
        Status: goal.status,
      }));
    case "roleGoals":
      return sources.roleGoals.map((goal) => ({
        Função: goal.role,
        "Meta Diária": goal.dailyTarget,
        Descrição: goal.description ?? "",
        Status: goal.status,
      }));
    default:
      return [];
  }
}

function sheetName(dataset: ExportDataset): string {
  const names: Record<ExportDataset, string> = {
    performance: "Desempenho",
    attendants: "Colaboradores",
    absences: "Ausencias",
    productionGoals: "Metas Producao",
    roleGoals: "Metas Funcao",
  };
  return names[dataset].slice(0, 31);
}

function buildFileStem(period: ExportPeriod): string {
  const date = new Date().toISOString().slice(0, 10);
  if (period.type === "all") return `ellos-exportacao-${date}`;
  const range = resolveExportDateRange(period);
  if (!range) return `ellos-exportacao-${date}`;
  return `ellos-exportacao-${range.start}_${range.end}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ";" });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
}

function downloadXlsx(
  sheets: { name: string; rows: Record<string, string | number>[] }[],
  filename: string
) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  XLSX.writeFile(workbook, filename);
}

export function executeExport(sources: ExportDataSources, options: ExportOptions): void {
  if (options.datasets.length === 0) {
    throw new Error("Selecione pelo menos um tipo de dado para exportar");
  }

  const range = resolveExportDateRange(options.period);
  const stem = buildFileStem(options.period);

  const sheets = options.datasets.map((dataset) => ({
    name: sheetName(dataset),
    rows: getFilteredRows(sources, options, dataset, range),
    dataset,
  }));

  const emptySheets = sheets.filter((sheet) => sheet.rows.length === 0);
  if (emptySheets.length === sheets.length) {
    throw new Error("Nenhum registro encontrado com os filtros selecionados");
  }

  if (options.format === "xlsx") {
    downloadXlsx(
      sheets.map(({ name, rows }) => ({ name, rows })),
      `${stem}.xlsx`
    );
    return;
  }

  if (options.datasets.length === 1) {
    const sheet = sheets[0];
    downloadCsv(sheet.rows, `${stem}-${sheet.dataset}.csv`);
    return;
  }

  sheets.forEach((sheet, index) => {
    window.setTimeout(() => {
      downloadCsv(sheet.rows, `${stem}-${sheet.dataset}.csv`);
    }, index * 300);
  });
}

export { DATASET_LABELS };

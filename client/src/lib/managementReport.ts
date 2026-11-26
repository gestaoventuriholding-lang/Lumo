import type { Attendant } from "@/types/attendant";
import type { AttendanceChannel, ProductionGoal } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { DashboardPeriod, DateRange } from "@/lib/dateRangeFilter";
import { periodScopeLabel, resolveDateRange } from "@/lib/dateRangeFilter";
import {
  buildAttendantSummaries,
  buildDashboardStats,
  buildProductivityTrend,
  compareAttendantSummaries,
  filterRecordsByRange,
  type AttendantPerformanceSummary,
  type ProductivityTrendPoint,
} from "@/lib/performanceMetrics";
import { formatAverageTime } from "@/lib/performanceStorage";
import type { Audit, AuditSettings } from "@/types/audit";
import { qualidadeNoPeriodo, type QualidadePeriodo } from "@/lib/auditLogic";

export type ManagementReportChannelFilter = "both" | AttendanceChannel;

export interface ManagementReportOptions {
  period: DashboardPeriod;
  periodValue: string;
  attendantIds: number[] | null;
  channels: ManagementReportChannelFilter;
}

export interface ManagementReportRankingRow {
  position: number;
  name: string;
  attendances: number;
  averageTime: string;
  metaPercent: number;
  score: number;
}

export interface ManagementReportSummary {
  totalAttendances: number;
  averagePercentage: number;
  attendantsWithRecords: number;
  totalAttendants: number;
}

export interface ManagementReportData {
  generatedAt: Date;
  period: DashboardPeriod;
  periodScope: string;
  dateRange: DateRange;
  channelFilter: ManagementReportChannelFilter;
  filtersLabel: string;
  summary: ManagementReportSummary;
  ligacaoRanking: ManagementReportRankingRow[];
  whatsappRanking: ManagementReportRankingRow[];
  productivityTrend: ProductivityTrendPoint[];
  /** Resumo das auditorias de atendimento do período (só quando as auditorias são informadas) */
  quality?: QualidadePeriodo;
}

/** Uma linha por colaborador com o total do período; entra todo mundo que teve atendimento */
function summariesToRankingRows(
  summaries: AttendantPerformanceSummary[]
): ManagementReportRankingRow[] {
  return [...summaries]
    .filter((summary) => summary.totalAttendances > 0)
    .sort(compareAttendantSummaries)
    .map((summary, index) => ({
      position: index + 1,
      name: summary.name,
      attendances: summary.totalAttendances,
      averageTime: formatAverageTime(summary.averageTimeMinutes),
      metaPercent: Math.round(summary.averagePercentage),
      score: Math.round(summary.performanceScore * 10) / 10,
    }));
}

function filterAttendantsForReport(
  attendants: Attendant[],
  attendantIds: number[] | null
): Attendant[] {
  if (!attendantIds || attendantIds.length === 0) return attendants;
  const idSet = new Set(attendantIds);
  return attendants.filter((attendant) => idSet.has(attendant.id));
}

function filterRecordsForReport(
  records: DailyPerformanceRecord[],
  dateRange: DateRange,
  attendantIds: number[] | null,
  channels: ManagementReportChannelFilter
): DailyPerformanceRecord[] {
  let filtered = filterRecordsByRange(records, dateRange);

  if (attendantIds && attendantIds.length > 0) {
    const idSet = new Set(attendantIds);
    filtered = filtered.filter((record) => idSet.has(record.attendantId));
  }

  if (channels !== "both") {
    filtered = filtered.filter((record) => record.channel === channels);
  }

  return filtered;
}

function buildFiltersLabel(
  attendants: Attendant[],
  attendantIds: number[] | null,
  channels: ManagementReportChannelFilter
): string {
  const parts: string[] = [];

  if (channels === "both") {
    parts.push("Canais: Ligação e WhatsApp");
  } else {
    parts.push(`Canal: ${channels}`);
  }

  if (!attendantIds || attendantIds.length === 0) {
    parts.push(`Colaboradores: todos (${attendants.length})`);
  } else {
    parts.push(
      `Colaboradores: ${attendantIds.length} selecionado${attendantIds.length === 1 ? "" : "s"}`
    );
  }

  return parts.join(" · ");
}

export interface BuildManagementReportInput {
  period: DashboardPeriod;
  dateRange: DateRange;
  attendants: Attendant[];
  performanceRecords: DailyPerformanceRecord[];
  productionGoals: ProductionGoal[];
  options?: Pick<ManagementReportOptions, "attendantIds" | "channels">;
  generatedAt?: Date;
}

export function buildManagementReportData(
  input: BuildManagementReportInput
): ManagementReportData {
  const {
    period,
    dateRange,
    attendants,
    performanceRecords,
    productionGoals,
    options,
    generatedAt = new Date(),
  } = input;

  const channelFilter = options?.channels ?? "both";
  const attendantIds = options?.attendantIds ?? null;
  const scopedAttendants = filterAttendantsForReport(attendants, attendantIds);
  const scopedRecords = filterRecordsForReport(
    performanceRecords,
    dateRange,
    attendantIds,
    channelFilter
  );

  const includeLigacao = channelFilter === "both" || channelFilter === "Ligação";
  const includeWhatsapp = channelFilter === "both" || channelFilter === "WhatsApp";

  const ligacaoSummaries = includeLigacao
    ? buildAttendantSummaries(
        scopedRecords,
        scopedAttendants,
        productionGoals,
        dateRange,
        "Ligação"
      )
    : [];
  const whatsappSummaries = includeWhatsapp
    ? buildAttendantSummaries(
        scopedRecords,
        scopedAttendants,
        productionGoals,
        dateRange,
        "WhatsApp"
      )
    : [];

  const dashboardStats = buildDashboardStats(
    scopedAttendants,
    scopedRecords,
    productionGoals,
    dateRange
  );
  const productivityTrend = buildProductivityTrend(
    scopedRecords,
    scopedAttendants,
    productionGoals,
    dateRange
  );

  return {
    generatedAt,
    period,
    periodScope: periodScopeLabel(period),
    dateRange,
    channelFilter,
    filtersLabel: buildFiltersLabel(scopedAttendants, attendantIds, channelFilter),
    summary: {
      totalAttendances: dashboardStats.totalAttendances,
      averagePercentage: Math.round(dashboardStats.averagePercentage * 10) / 10,
      attendantsWithRecords: dashboardStats.attendantsWithRecords,
      totalAttendants: scopedAttendants.length,
    },
    ligacaoRanking: includeLigacao ? summariesToRankingRows(ligacaoSummaries) : [],
    whatsappRanking: includeWhatsapp ? summariesToRankingRows(whatsappSummaries) : [],
    productivityTrend,
  };
}

export function resolveManagementReportDateRange(
  options: Pick<ManagementReportOptions, "period" | "periodValue">
): DateRange {
  return resolveDateRange(options.period, options.periodValue);
}

export function getAttendantsWithRecordsInRange(
  records: DailyPerformanceRecord[],
  attendants: Attendant[],
  dateRange: DateRange
): Attendant[] {
  const ids = new Set(
    filterRecordsByRange(records, dateRange).map((record) => record.attendantId)
  );
  return attendants.filter((attendant) => ids.has(attendant.id));
}

export function managementReportFilename(data: ManagementReportData): string {
  const stamp =
    data.dateRange.start === data.dateRange.end
      ? data.dateRange.start
      : `${data.dateRange.start}_${data.dateRange.end}`;
  const channelSuffix =
    data.channelFilter === "both"
      ? ""
      : data.channelFilter === "Ligação"
        ? "-ligacao"
        : "-whatsapp";
  return `relatorio-gerencial-ellos-${stamp}${channelSuffix}.pdf`;
}

export function hasManagementReportContent(data: ManagementReportData): boolean {
  return (
    data.summary.totalAttendances > 0 ||
    data.ligacaoRanking.length > 0 ||
    data.whatsappRanking.length > 0 ||
    data.productivityTrend.length > 0
  );
}

export function buildManagementReportPreview(
  attendants: Attendant[],
  performanceRecords: DailyPerformanceRecord[],
  productionGoals: ProductionGoal[],
  options: ManagementReportOptions,
  auditoria?: { audits: Audit[]; settings: Pick<AuditSettings, "minScore"> }
): ManagementReportData {
  const dateRange = resolveManagementReportDateRange(options);
  const base = buildManagementReportData({
    period: options.period,
    dateRange,
    attendants,
    performanceRecords,
    productionGoals,
    options: {
      attendantIds: options.attendantIds,
      channels: options.channels,
    },
  });
  if (!auditoria) return base;
  // Mesmos filtros do relatório: colaboradores escolhidos e canal
  const ids = options.attendantIds;
  const colaboradores = ids ? attendants.filter((a) => ids.includes(a.id)) : attendants;
  const audits = options.channels === "both" ? auditoria.audits : auditoria.audits.filter((a) => a.channel === options.channels);
  return { ...base, quality: qualidadeNoPeriodo(audits, colaboradores, auditoria.settings, dateRange) };
}

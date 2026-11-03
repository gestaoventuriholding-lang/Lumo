import type { Attendant } from "@/types/attendant";
import type { AttendanceChannel, PerformanceIndicator, ProductionGoal } from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { DashboardPeriod, DateRange } from "@/lib/dateRangeFilter";
import { periodScopeLabel, resolveDateRange } from "@/lib/dateRangeFilter";
import {
  buildAttendantSummaries,
  buildDashboardStats,
  buildProductivityTrend,
  compareAttendantSummaries,
  filterRecordsByRange,
  recordsToIndicators,
  type AttendantPerformanceSummary,
  type ProductivityTrendPoint,
} from "@/lib/performanceMetrics";
import { formatAverageTime } from "@/lib/performanceStorage";

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

export interface ManagementReportBelowGoalRow {
  name: string;
  role: string;
  channel: string;
  target: number;
  produced: number;
  percentage: number;
  difference: number;
  alertLevel: "yellow" | "red";
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
  belowGoal: ManagementReportBelowGoalRow[];
  productivityTrend: ProductivityTrendPoint[];
}

function summariesToRankingRows(
  summaries: AttendantPerformanceSummary[],
  limit = 10
): ManagementReportRankingRow[] {
  return [...summaries]
    .filter((summary) => summary.totalAttendances > 0)
    .sort(compareAttendantSummaries)
    .slice(0, limit)
    .map((summary, index) => ({
      position: index + 1,
      name: summary.name,
      attendances: summary.totalAttendances,
      averageTime: formatAverageTime(summary.averageTimeMinutes),
      metaPercent: Math.round(summary.averagePercentage),
      score: Math.round(summary.performanceScore * 10) / 10,
    }));
}

function indicatorsToBelowGoalRows(
  indicators: PerformanceIndicator[],
  channelFilter: ManagementReportChannelFilter
): ManagementReportBelowGoalRow[] {
  return indicators
    .filter((indicator) => indicator.alertLevel !== "green")
    .filter(
      (indicator) => channelFilter === "both" || indicator.channel === channelFilter
    )
    .sort((a, b) => a.percentage - b.percentage)
    .map((indicator) => ({
      name: indicator.attendantName,
      role: indicator.role,
      channel: indicator.channel,
      target: indicator.dailyTarget,
      produced: indicator.produced,
      percentage: Math.round(indicator.percentage * 10) / 10,
      difference: indicator.difference,
      alertLevel: indicator.alertLevel === "yellow" ? "yellow" : "red",
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

  const periodIndicators = recordsToIndicators(
    scopedRecords,
    scopedAttendants,
    productionGoals,
    dateRange
  );
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
    belowGoal: indicatorsToBelowGoalRows(periodIndicators, channelFilter),
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
  options: ManagementReportOptions
): ManagementReportData {
  const dateRange = resolveManagementReportDateRange(options);
  return buildManagementReportData({
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
}

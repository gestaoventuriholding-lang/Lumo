import type { Attendant } from "@/types/attendant";
import type {
  AlertLevel,
  AttendanceChannel,
  JobRole,
  PerformanceAlert,
  PerformanceIndicator,
  ProductionGoal,
} from "@/types/goals";
import type { DailyPerformanceRecord } from "@/types/performance";
import type { DateRange } from "@/lib/dateRangeFilter";
import { getLocalDateString } from "@/lib/performanceStorage";
import { isChannelSummaryImportRow, normalizeName } from "@/lib/spreadsheetImport";

function getAlertLevel(percentage: number): AlertLevel {
  if (percentage >= 100) return "green";
  if (percentage >= 85) return "yellow";
  return "red";
}

export function filterRecordsByRange(
  records: DailyPerformanceRecord[],
  range: DateRange
): DailyPerformanceRecord[] {
  return records.filter((record) => record.date >= range.start && record.date <= range.end);
}

/** Nomes de importação consolidada (ex.: "Ligação REL 067") — totais diários por canal */
export function isReportSummaryAttendant(name: string): boolean {
  return isChannelSummaryImportRow(name);
}

export function dedupePerformanceRecords(
  records: DailyPerformanceRecord[]
): DailyPerformanceRecord[] {
  const map = new Map<string, DailyPerformanceRecord>();

  for (const record of records) {
    const key = `${normalizeName(record.attendantName)}|${record.date}|${record.channel}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, record);
      continue;
    }

    const existingTs = existing.updatedAt || existing.createdAt || "";
    const recordTs = record.updatedAt || record.createdAt || "";
    if (recordTs >= existingTs) {
      map.set(key, record);
    }
  }

  return Array.from(map.values());
}

function recordsForVolumeMetrics(records: DailyPerformanceRecord[]): DailyPerformanceRecord[] {
  const deduped = dedupePerformanceRecords(records);
  const summaryByDayChannel = new Map<string, DailyPerformanceRecord>();

  for (const record of deduped) {
    if (isChannelSummaryImportRow(record.attendantName)) {
      summaryByDayChannel.set(`${record.date}|${record.channel}`, record);
    }
  }

  if (summaryByDayChannel.size === 0) {
    return deduped;
  }

  const result: DailyPerformanceRecord[] = Array.from(summaryByDayChannel.values());
  for (const record of deduped) {
    if (isChannelSummaryImportRow(record.attendantName)) continue;
    if (!summaryByDayChannel.has(`${record.date}|${record.channel}`)) {
      result.push(record);
    }
  }

  return result;
}

function filterVolumeRecordsByRange(
  records: DailyPerformanceRecord[],
  range: DateRange
): DailyPerformanceRecord[] {
  return filterRecordsByRange(recordsForVolumeMetrics(records), range);
}

export function getDaysWithRecordsInRange(
  records: DailyPerformanceRecord[],
  range: DateRange
): string[] {
  return Array.from(
    new Set(
      filterRecordsByRange(records, range).map((record) => record.date)
    )
  ).sort((a, b) => b.localeCompare(a));
}

export function getDailyTarget(
  channel: AttendanceChannel,
  productionGoals: ProductionGoal[]
): number {
  const goal = productionGoals.find((g) => g.channel === channel && g.status === "Ativo");
  return goal?.dailyTarget ?? 0;
}

/** Meta do registro: meta diária × dias cobertos (total de período) */
function getRecordTarget(record: DailyPerformanceRecord, productionGoals: ProductionGoal[]): number {
  return getDailyTarget(record.channel, productionGoals) * Math.max(1, record.periodDays ?? 1);
}

/** Totais de período não têm dia próprio: ficam fora dos gráficos diários */
function withoutPeriodTotals(records: DailyPerformanceRecord[]): DailyPerformanceRecord[] {
  return records.filter((record) => (record.periodDays ?? 1) <= 1);
}

export function recordsToIndicators(
  records: DailyPerformanceRecord[],
  attendants: Attendant[],
  productionGoals: ProductionGoal[],
  range?: DateRange
): PerformanceIndicator[] {
  const periodRecords = range ? filterRecordsByRange(records, range) : records;

  return periodRecords.map((record) => {
    const attendant = attendants.find((a) => a.id === record.attendantId);
    const dailyTarget = getRecordTarget(record, productionGoals);
    const produced = record.attendancesCount;
    const difference = produced - dailyTarget;
    const percentage = dailyTarget > 0 ? (produced / dailyTarget) * 100 : 0;

    return {
      id: record.id,
      attendantId: record.attendantId,
      attendantName: attendant?.name ?? record.attendantName,
      role: (attendant?.role ?? "Atendente") as JobRole,
      date: record.date,
      channel: record.channel,
      dailyTarget,
      produced,
      difference,
      percentage,
      alertLevel: getAlertLevel(percentage),
    };
  });
}

export interface AttendantPerformanceSummary {
  attendantId: number;
  name: string;
  role: string;
  totalAttendances: number;
  averageTimeMinutes: number;
  averagePercentage: number;
  /** Atendimentos por minuto de TMA — volume + agilidade */
  performanceScore: number;
  ranking: number;
}

/**
 * Quanto maior, melhor: combina volume (atendimentos) com agilidade (menor TMA).
 * Ex.: 100 atend. em 4min → 25 pts · 80 atend. em 3min → 26,7 pts (fica à frente).
 */
export function formatGoalPercentage(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value)}%`;
}

export function goalPercentageTone(value: number): "green" | "yellow" | "red" | "muted" {
  if (!Number.isFinite(value) || value <= 0) return "muted";
  if (value >= 100) return "green";
  if (value >= 85) return "yellow";
  return "red";
}

export function calculatePerformanceScore(
  totalAttendances: number,
  averageTimeMinutes: number,
  averagePercentage: number
): number {
  if (totalAttendances <= 0 || averageTimeMinutes <= 0) return 0;

  const throughput = totalAttendances / averageTimeMinutes;
  const metaFactor = averagePercentage / 100;

  return throughput * metaFactor;
}

export function compareAttendantSummaries(
  a: AttendantPerformanceSummary,
  b: AttendantPerformanceSummary
): number {
  if (b.performanceScore !== a.performanceScore) {
    return b.performanceScore - a.performanceScore;
  }
  if (b.totalAttendances !== a.totalAttendances) {
    return b.totalAttendances - a.totalAttendances;
  }
  if (a.averageTimeMinutes !== b.averageTimeMinutes) {
    return a.averageTimeMinutes - b.averageTimeMinutes;
  }
  return b.averagePercentage - a.averagePercentage;
}

export function buildAttendantSummaries(
  records: DailyPerformanceRecord[],
  attendants: Attendant[],
  productionGoals: ProductionGoal[],
  range: DateRange,
  channel?: AttendanceChannel
): AttendantPerformanceSummary[] {
  let periodRecords = filterVolumeRecordsByRange(records, range);
  if (channel) {
    periodRecords = periodRecords.filter((record) => record.channel === channel);
  }

  const summaries = attendants.map((attendant) => {
    const attendantRecords = periodRecords.filter((r) => r.attendantId === attendant.id);

    if (attendantRecords.length === 0) {
      return {
        attendantId: attendant.id,
        name: attendant.name,
        role: attendant.role,
        totalAttendances: 0,
        averageTimeMinutes: 0,
        averagePercentage: 0,
        performanceScore: 0,
        ranking: 0,
      };
    }

    const totalAttendances = attendantRecords.reduce((sum, r) => sum + r.attendancesCount, 0);
    const weightedTime =
      attendantRecords.reduce((sum, r) => sum + r.averageTimeMinutes * r.attendancesCount, 0) /
      totalAttendances;

    const totalTarget = attendantRecords.reduce(
      (sum, record) => sum + getRecordTarget(record, productionGoals),
      0
    );
    const averagePercentage =
      totalTarget > 0 ? (totalAttendances / totalTarget) * 100 : 0;

    const performanceScore = calculatePerformanceScore(
      totalAttendances,
      weightedTime,
      averagePercentage
    );

    return {
      attendantId: attendant.id,
      name: attendant.name,
      role: attendant.role,
      totalAttendances,
      averageTimeMinutes: weightedTime,
      averagePercentage,
      performanceScore,
      ranking: 0,
    };
  });

  const withData = summaries
    .filter((s) => s.totalAttendances > 0)
    .sort(compareAttendantSummaries);

  withData.forEach((summary, index) => {
    summary.ranking = index + 1;
  });

  const rankedIds = new Set(withData.map((s) => s.attendantId));
  return [...withData, ...summaries.filter((s) => !rankedIds.has(s.attendantId))];
}

export interface DashboardStats {
  totalAttendants: number;
  totalAttendances: number;
  averagePercentage: number;
  averageTime: number;
  attendantsWithRecords: number;
}

export function buildDashboardStats(
  attendants: Attendant[],
  records: DailyPerformanceRecord[],
  productionGoals: ProductionGoal[],
  range: DateRange
): DashboardStats {
  const periodRecords = filterVolumeRecordsByRange(records, range);
  const indicators = recordsToIndicators(
    recordsForVolumeMetrics(records),
    attendants,
    productionGoals,
    range
  );

  const totalAttendances = periodRecords.reduce((sum, r) => sum + r.attendancesCount, 0);

  const averagePercentage =
    indicators.length > 0
      ? indicators.reduce((sum, i) => sum + i.percentage, 0) / indicators.length
      : 0;

  const averageTime =
    totalAttendances > 0
      ? periodRecords.reduce((sum, r) => sum + r.averageTimeMinutes * r.attendancesCount, 0) /
        totalAttendances
      : 0;

  return {
    totalAttendants: attendants.length,
    totalAttendances,
    averagePercentage,
    averageTime,
    attendantsWithRecords: new Set(periodRecords.map((r) => r.attendantId)).size,
  };
}

export function todayRange(): DateRange {
  const today = getLocalDateString();
  return { start: today, end: today, label: today };
}

function formatTrendDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}

export interface ProductivityTrendPoint {
  date: string;
  label: string;
  productivity: number;
  target: number;
}

export function buildProductivityTrend(
  records: DailyPerformanceRecord[],
  attendants: Attendant[],
  productionGoals: ProductionGoal[],
  range: DateRange
): ProductivityTrendPoint[] {
  const periodRecords = filterRecordsByRange(withoutPeriodTotals(records), range);
  const byDate = new Map<string, DailyPerformanceRecord[]>();

  for (const record of periodRecords) {
    const group = byDate.get(record.date) ?? [];
    group.push(record);
    byDate.set(record.date, group);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRecords]) => {
      const indicators = recordsToIndicators(dayRecords, attendants, productionGoals);
      const productivity =
        indicators.length > 0
          ? indicators.reduce((sum, item) => sum + item.percentage, 0) / indicators.length
          : 0;

      return {
        date,
        label: formatTrendDateLabel(date),
        productivity: Math.round(productivity * 10) / 10,
        target: 100,
      };
    });
}

export interface AttendancesTrendPoint {
  date: string;
  label: string;
  attendances: number;
  ligacao: number;
  whatsapp: number;
}

export interface ChannelAttendanceTotals {
  total: number;
  ligacao: number;
  whatsapp: number;
}

export function buildChannelAttendanceTotals(
  records: DailyPerformanceRecord[],
  range: DateRange
): ChannelAttendanceTotals {
  const periodRecords = filterVolumeRecordsByRange(records, range);

  return periodRecords.reduce<ChannelAttendanceTotals>(
    (totals, record) => {
      totals.total += record.attendancesCount;
      if (record.channel === "Ligação") {
        totals.ligacao += record.attendancesCount;
      } else if (record.channel === "WhatsApp") {
        totals.whatsapp += record.attendancesCount;
      }
      return totals;
    },
    { total: 0, ligacao: 0, whatsapp: 0 }
  );
}

export function buildAttendancesTrend(
  records: DailyPerformanceRecord[],
  range: DateRange
): AttendancesTrendPoint[] {
  const periodRecords = filterVolumeRecordsByRange(withoutPeriodTotals(records), range);
  const byDate = new Map<string, { attendances: number; ligacao: number; whatsapp: number }>();

  for (const record of periodRecords) {
    const entry = byDate.get(record.date) ?? { attendances: 0, ligacao: 0, whatsapp: 0 };
    entry.attendances += record.attendancesCount;
    if (record.channel === "Ligação") {
      entry.ligacao += record.attendancesCount;
    } else if (record.channel === "WhatsApp") {
      entry.whatsapp += record.attendancesCount;
    }
    byDate.set(record.date, entry);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      label: formatTrendDateLabel(date),
      attendances: counts.attendances,
      ligacao: counts.ligacao,
      whatsapp: counts.whatsapp,
    }));
}

const TEAM_CHART_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#06b6d4", "#ec4899"];

export const CHANNEL_CHART_COLORS = {
  ligacao: "#3b82f6",
  whatsapp: "#10b981",
} as const;

export function buildChannelDistribution(
  records: DailyPerformanceRecord[],
  range: DateRange
): TeamDistributionPoint[] {
  const totals = buildChannelAttendanceTotals(records, range);

  return [
    { name: "Ligação", value: totals.ligacao, color: CHANNEL_CHART_COLORS.ligacao },
    { name: "WhatsApp", value: totals.whatsapp, color: CHANNEL_CHART_COLORS.whatsapp },
  ].filter((item) => item.value > 0);
}

export interface TeamDistributionPoint {
  name: string;
  value: number;
  color: string;
}

export function buildTeamDistribution(
  records: DailyPerformanceRecord[],
  attendants: Attendant[],
  range: DateRange
): TeamDistributionPoint[] {
  const periodRecords = filterRecordsByRange(records, range);
  const attendantMap = new Map(attendants.map((a) => [a.id, a]));
  const byGroup = new Map<string, number>();

  for (const record of periodRecords) {
    const attendant = attendantMap.get(record.attendantId);
    const group = attendant?.role?.trim() || "Geral";
    byGroup.set(group, (byGroup.get(group) ?? 0) + record.attendancesCount);
  }

  return Array.from(byGroup.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({
      name,
      value,
      color: TEAM_CHART_COLORS[index % TEAM_CHART_COLORS.length],
    }));
}

export interface OperationHighlight {
  title: string;
  value: string;
  detail: string;
  tone: "green" | "red" | "orange";
}

export function buildOperationHighlights(
  summaries: AttendantPerformanceSummary[],
  indicators: PerformanceIndicator[]
): OperationHighlight[] {
  const withData = summaries.filter((s) => s.totalAttendances > 0);
  if (withData.length === 0) return [];

  const sorted = [...withData].sort(compareAttendantSummaries);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const highlights: OperationHighlight[] = [];

  highlights.push({
    title: "Melhor Desempenho",
    value: best.name,
    detail: `${best.totalAttendances} atend. · ${formatMinutesLabel(best.averageTimeMinutes)} TMA · ${Math.round(best.averagePercentage)}% meta`,
    tone: "green",
  });

  if (worst.name !== best.name) {
    highlights.push({
      title: "Precisa Atenção",
      value: worst.name,
      detail: `${worst.totalAttendances} atend. · ${formatMinutesLabel(worst.averageTimeMinutes)} TMA · ${Math.round(worst.averagePercentage)}% meta`,
      tone: "red",
    });
  }

  const belowMeta = new Set(
    indicators.filter((i) => i.alertLevel === "red").map((i) => i.attendantId)
  ).size;

  if (belowMeta > 0) {
    highlights.push({
      title: "Abaixo da Meta",
      value: `${belowMeta} colaborador(es)`,
      detail: "Registros abaixo de 85% no período",
      tone: "orange",
    });
  }

  return highlights;
}

export function buildPerformanceAlerts(indicators: PerformanceIndicator[]): PerformanceAlert[] {
  return indicators
    .filter((indicator) => indicator.alertLevel !== "green")
    .sort((a, b) => {
      const levelOrder = { red: 0, yellow: 1, green: 2 };
      const levelDiff = levelOrder[a.alertLevel] - levelOrder[b.alertLevel];
      if (levelDiff !== 0) return levelDiff;
      return a.percentage - b.percentage;
    })
    .map((indicator) => ({
      id: indicator.id,
      attendantId: indicator.attendantId,
      attendantName: indicator.attendantName,
      role: indicator.role,
      date: indicator.date,
      dailyTarget: indicator.dailyTarget,
      produced: indicator.produced,
      percentage: indicator.percentage,
      message:
        indicator.alertLevel === "red"
          ? `${indicator.channel}: ${indicator.produced} de ${indicator.dailyTarget} atendimentos (${indicator.percentage.toFixed(1)}%).`
          : `${indicator.channel}: ${indicator.produced} de ${indicator.dailyTarget} — ${indicator.percentage.toFixed(1)}% da meta.`,
      alertLevel: indicator.alertLevel,
      timestamp: `${indicator.date}T12:00:00`,
      read: false,
    }));
}

function formatMinutesLabel(minutes: number): string {
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);
  if (seconds === 0) return `${wholeMinutes}m`;
  return `${wholeMinutes}m ${seconds}s`;
}

import type { DateRange } from "@/lib/dateRangeFilter";
import type { AttendantPerformanceSummary } from "@/lib/performanceMetrics";

function parseIso(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const DAY_MS = 86_400_000;

function daysBetween(start: string, end: string): number {
  return Math.round((parseIso(end).getTime() - parseIso(start).getTime()) / DAY_MS) + 1;
}

function isWholeMonth(range: { start: string; end: string }): boolean {
  const start = parseIso(range.start);
  const end = parseIso(range.end);
  const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === lastDay
  );
}

export interface PreviousRange {
  start: string;
  end: string;
  label: string;
  /** Texto para "vs ___": mês anterior, semana anterior... */
  name: string;
}

/** Período imediatamente anterior e do mesmo tamanho (mês fechado volta para o mês anterior) */
export function previousRange(range: Pick<DateRange, "start" | "end">): PreviousRange {
  if (isWholeMonth(range)) {
    const start = parseIso(range.start);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
    return { start: toIso(prevStart), end: toIso(prevEnd), label: "mês anterior", name: "mês anterior" };
  }
  const days = daysBetween(range.start, range.end);
  const end = parseIso(range.start);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const name = days === 1 ? "dia anterior" : days === 7 ? "semana anterior" : "período anterior";
  return { start: toIso(start), end: toIso(end), label: name, name };
}

export interface Kpis {
  totalAttendances: number;
  averageTime: number;
  attendantsCount: number;
  averagePercentage: number;
}

/** Totais do período a partir dos resumos por colaborador (mesma conta da tela de Desempenho) */
export function kpisFromSummaries(summaries: AttendantPerformanceSummary[]): Kpis {
  const withData = summaries.filter((s) => s.totalAttendances > 0);
  if (withData.length === 0) {
    return { totalAttendances: 0, averageTime: 0, attendantsCount: 0, averagePercentage: 0 };
  }
  const totalAttendances = withData.reduce((sum, s) => sum + s.totalAttendances, 0);
  const averageTime =
    withData.reduce((sum, s) => sum + s.averageTimeMinutes * s.totalAttendances, 0) / totalAttendances;
  const averagePercentage =
    withData.reduce((sum, s) => sum + s.averagePercentage, 0) / withData.length;
  return { totalAttendances, averageTime, attendantsCount: withData.length, averagePercentage };
}

export type ChangeTone = "good" | "bad" | "neutral";

export interface Change {
  text: string;
  tone: ChangeTone;
}

/**
 * Variação frente ao período anterior. `unit` "percent" compara em % do valor anterior;
 * "points" compara pontos percentuais (para valores que já são %). `lowerIsBetter` inverte o tom.
 * Sem dado anterior (zero) não há como comparar, então avisa.
 */
export function describeChange(
  current: number,
  previous: number,
  versus: string,
  options: { unit?: "percent" | "points"; lowerIsBetter?: boolean } = {}
): Change {
  if (previous <= 0 || current <= 0) {
    return { text: `Sem dados no ${versus} para comparar`, tone: "neutral" };
  }
  const unit = options.unit ?? "percent";
  const diff = unit === "points" ? current - previous : ((current - previous) / previous) * 100;
  const rounded = Math.round(diff * 10) / 10;
  if (rounded === 0) return { text: `= igual ao ${versus}`, tone: "neutral" };
  const arrow = rounded > 0 ? "▲" : "▼";
  const value = Math.abs(rounded).toLocaleString("pt-BR");
  const suffix = unit === "points" ? " p.p." : "%";
  const better = options.lowerIsBetter ? rounded < 0 : rounded > 0;
  return { text: `${arrow} ${value}${suffix} vs ${versus}`, tone: better ? "good" : "bad" };
}

import type { DailyPerformanceRecord } from "@/types/performance";
import type { ProductivityRecord } from "@/types/productivity";
import type { AttendanceChannel } from "@/types/goals";

function parseIso(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Dias úteis (seg–sex) entre duas datas, inclusive; mínimo 1 */
export function countWeekdays(start: string, end: string): number {
  const last = parseIso(end);
  let count = 0;
  for (const day = parseIso(start); day <= last; day.setDate(day.getDate() + 1)) {
    const weekday = day.getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return Math.max(1, count);
}

type Period = Pick<ProductivityRecord, "attendantId" | "channel" | "periodStart" | "periodEnd">;

/**
 * Registro diário que veio de um relatório por dia (existe uma produtividade de 1 dia igual a ele).
 * Os outros são lançamentos manuais: ajustes do gestor, que somam ao relatório sem substituí-lo.
 */
function isReportBacked(record: DailyPerformanceRecord, productivity: ProductivityRecord[]): boolean {
  return productivity.some(
    (p) =>
      p.periodStart === p.periodEnd &&
      p.periodStart === record.date &&
      p.attendantId === record.attendantId &&
      p.channel === record.channel
  );
}

/** Já existe relatório por dia cobrindo este total? Então somar o total duplicaria os atendimentos */
function hasDailyReportInside(
  records: DailyPerformanceRecord[],
  productivity: ProductivityRecord[],
  p: Period
): boolean {
  return records.some(
    (r) =>
      r.attendantId === p.attendantId &&
      r.channel === p.channel &&
      r.date >= p.periodStart &&
      r.date <= p.periodEnd &&
      isReportBacked(r, productivity)
  );
}

/** Dias úteis do período que já têm lançamento manual (a meta desses dias já está nos lançamentos) */
function manualWeekdays(records: DailyPerformanceRecord[], productivity: ProductivityRecord[], p: Period): number {
  const days = new Set<string>();
  records.forEach((r) => {
    if (
      r.attendantId === p.attendantId &&
      r.channel === p.channel &&
      r.date >= p.periodStart &&
      r.date <= p.periodEnd &&
      !isReportBacked(r, productivity)
    ) {
      const weekday = parseIso(r.date).getDay();
      if (weekday !== 0 && weekday !== 6) days.add(r.date);
    }
  });
  return days.size;
}

/**
 * Junta os totais de período (relatório sem dia a dia) aos registros diários, para
 * Dashboard e Desempenho baterem com o relatório. O total só entra quando o período
 * do relatório cabe inteiro no filtro e não duplica quem já tem relatório por dia no período.
 * Lançamentos manuais não substituem o total: somam a ele (a meta desses dias não conta em dobro).
 * Os registros criados aqui não são gravados (id negativo, `periodDays` preenchido).
 */
export function mergePeriodTotals(
  records: DailyPerformanceRecord[],
  productivity: ProductivityRecord[],
  range: { start: string; end: string }
): DailyPerformanceRecord[] {
  const totals = productivity.filter(
    (p) =>
      p.periodEnd > p.periodStart &&
      p.periodStart >= range.start &&
      p.periodEnd <= range.end &&
      p.attendancesCount > 0
  );
  if (totals.length === 0) return records;

  const synthetic: DailyPerformanceRecord[] = [];
  totals.forEach((p) => {
    if (hasDailyReportInside(records, productivity, p)) return;
    synthetic.push({
      id: -p.id,
      attendantId: p.attendantId,
      attendantName: p.attendantName,
      date: p.periodEnd,
      channel: p.channel as AttendanceChannel,
      attendancesCount: p.attendancesCount,
      averageTimeMinutes: p.tmaSeconds != null ? Math.round((p.tmaSeconds / 60) * 100) / 100 : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      periodDays: Math.max(
        1,
        countWeekdays(p.periodStart, p.periodEnd) - manualWeekdays(records, productivity, p)
      ),
    });
  });
  return synthetic.length > 0 ? [...records, ...synthetic] : records;
}

export interface HiddenPeriodTotal {
  periodStart: string;
  periodEnd: string;
  attendances: number;
}

/**
 * Totais de período que tocam o filtro mas não cabem nele (então ficam de fora das contas).
 * Serve para avisar a pessoa em vez de deixar números "sumirem" sem explicação.
 */
export function findHiddenPeriodTotals(
  records: DailyPerformanceRecord[],
  productivity: ProductivityRecord[],
  range: { start: string; end: string }
): HiddenPeriodTotal[] {
  const groups = new Map<string, HiddenPeriodTotal>();
  productivity.forEach((p) => {
    if (p.periodEnd <= p.periodStart || p.attendancesCount <= 0) return;
    const overlaps = p.periodStart <= range.end && p.periodEnd >= range.start;
    const contained = p.periodStart >= range.start && p.periodEnd <= range.end;
    if (!overlaps || contained) return;
    if (hasDailyReportInside(records, productivity, p)) return;
    const key = `${p.periodStart}|${p.periodEnd}`;
    const group = groups.get(key) ?? { periodStart: p.periodStart, periodEnd: p.periodEnd, attendances: 0 };
    group.attendances += p.attendancesCount;
    groups.set(key, group);
  });
  return Array.from(groups.values());
}
